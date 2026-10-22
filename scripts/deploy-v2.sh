#!/usr/bin/env bash
# Deploy app dispar-v2 ke produksi dengan cara "swap container".
#
# Stack 6 bukan git stack lagi, jadi StackGitRedeploy tidak berlaku. Alurnya:
#   1. build image dispar-v2:<sha> di LAPTOP dari commit HEAD (bukan di server —
#      build di server pernah membekukan containerd)
#   2. smoke test lokal (halaman utama harus 200)
#   3. kirim image ke server: docker save → Docker API images/load lewat Portainer
#   4. buat dispar-v2-next dengan config container lama (+ LLM_* bila diberikan),
#      hentikan yang lama, ganti nama lama → dispar-v2-rollback-<sha>, nama baru → dispar-v2
#   5. verifikasi :13032 dan https://dispar.rantai.dev → 200; kalau gagal, otomatis swap balik
#
# Pakai:
#   scripts/deploy-v2.sh            # deploy HEAD
#   LLM_KEY=… LLM_URL=… LLM_MODEL=… scripts/deploy-v2.sh   # sekaligus set/ganti LLM
#   (tanpa LLM_* → nilai LLM di container lama dibawa apa adanya)
#
# Butuh: docker lokal, python3, curl, dan PORTAINER_KEY di .env root (gitignored).
# Tidak pernah mencetak nilai env.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

PORTAINER_URL="${PORTAINER_URL_V2:-https://192.168.18.148:9443}"
ENDPOINT="${PORTAINER_ENDPOINT:-3}"
HOST="${DEPLOY_HOST:-192.168.18.148}"
SHA="$(git rev-parse --short HEAD)"
IMAGE="dispar-v2:${SHA}"

# Simpan LLM_* dari pemanggil sebelum .env dibaca (supaya tidak tertimpa).
CALLER_LLM_URL="${LLM_URL:-}"; CALLER_LLM_MODEL="${LLM_MODEL:-}"; CALLER_LLM_KEY="${LLM_KEY:-}"
if [[ -z "${PORTAINER_KEY:-}" && -f "$ROOT/.env" ]]; then
  PORTAINER_KEY="$(grep -E '^PORTAINER_KEY=' "$ROOT/.env" | head -1 | cut -d= -f2-)"
fi
[[ -n "${PORTAINER_KEY:-}" ]] || { echo "PORTAINER_KEY tidak ada (env atau .env root)"; exit 1; }
export PORTAINER_URL ENDPOINT HOST SHA IMAGE PORTAINER_KEY
export NEW_LLM_URL="$CALLER_LLM_URL" NEW_LLM_MODEL="$CALLER_LLM_MODEL" NEW_LLM_KEY="$CALLER_LLM_KEY"

step() { printf '\n== %s\n' "$*"; }

step "0. Prasyarat"
if ! git diff --quiet HEAD -- platform-v2; then
  echo "Ada perubahan platform-v2 yang belum di-commit — image dibangun dari HEAD, bukan dari working tree."
fi
git fetch -q origin main
if ! git merge-base --is-ancestor HEAD origin/main; then
  echo "HEAD ($SHA) belum ada di origin/main. Push dulu: git push origin main && git push lama main"; exit 1
fi
curl -sk -m 10 -o /dev/null -w '' -H "X-API-Key: $PORTAINER_KEY" "$PORTAINER_URL/api/status" \
  || { echo "Portainer $PORTAINER_URL tidak bisa dihubungi"; exit 1; }
echo "commit $SHA, image $IMAGE, Portainer $PORTAINER_URL (endpoint $ENDPOINT)"

step "1. Build image lokal dari commit $SHA"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git archive "$SHA" platform-v2 | tar -x -C "$TMP"
docker build -q -t "$IMAGE" "$TMP/platform-v2"

step "2. Smoke test lokal"
SMOKE_ENV=(-e PORT=3032 -e AI_WARM_DATA_MAP=0)
if [[ -f platform-v2/.env.local ]]; then
  # CH_* dari .env.local; CH_URL dipaksa ke server produksi.
  while IFS='=' read -r k v; do
    [[ "$k" =~ ^CH_(USER|PASSWORD)$ ]] && SMOKE_ENV+=(-e "$k=$v")
  done < <(grep -E '^CH_(USER|PASSWORD)=' platform-v2/.env.local)
fi
SMOKE_ENV+=(-e "CH_URL=http://$HOST:18123")
CID="$(docker run -d --rm -p 13399:3032 "${SMOKE_ENV[@]}" "$IMAGE")"
ok=""
for _ in $(seq 1 30); do
  code="$(curl -s -m 5 -o /dev/null -w '%{http_code}' http://localhost:13399/ || true)"
  [[ "$code" == "200" ]] && { ok=1; break; }
  sleep 2
done
docker stop "$CID" >/dev/null || true
[[ -n "$ok" ]] || { echo "Smoke test gagal: / tidak 200 (terakhir: ${code:-?})"; exit 1; }
echo "smoke test OK"

step "3. Kirim image ke server (images/load)"
docker save "$IMAGE" | curl -sk --fail -m 900 -X POST \
  -H "X-API-Key: $PORTAINER_KEY" -H "Content-Type: application/x-tar" \
  --data-binary @- "$PORTAINER_URL/api/endpoints/$ENDPOINT/docker/images/load?quiet=1" >/dev/null
echo "image terkirim"

step "4–5. Swap container + verifikasi"
python3 - <<'PY'
import json, os, ssl, sys, time, urllib.request, urllib.error

BASE = f"{os.environ['PORTAINER_URL']}/api/endpoints/{os.environ['ENDPOINT']}/docker"
KEY, SHA, IMAGE, HOST = os.environ["PORTAINER_KEY"], os.environ["SHA"], os.environ["IMAGE"], os.environ["HOST"]
CTX = ssl._create_unverified_context()

def api(method, path, body=None, ok=(200, 201, 204, 304)):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"X-API-Key": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=120) as r:
            raw = r.read()
            return json.loads(raw) if raw.strip().startswith(b"{") or raw.strip().startswith(b"[") else None
    except urllib.error.HTTPError as e:
        if e.code in ok:
            return None
        raise SystemExit(f"Docker API {method} {path} → {e.code}: {e.read()[:300]!r}")

def http_code(url):
    try:
        with urllib.request.urlopen(url, context=CTX, timeout=30) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0

def healthy():
    for _ in range(40):
        a, b = http_code(f"http://{HOST}:13032/"), http_code("https://dispar.rantai.dev/")
        if a == 200 and b == 200:
            return True
        time.sleep(3)
    print(f"verifikasi gagal: :13032 → {a}, publik → {b}")
    return False

old = api("GET", "/containers/dispar-v2/json")
old_image = old["Config"]["Image"]
if old_image == IMAGE:
    sys.exit(f"dispar-v2 sudah memakai {IMAGE} — tidak ada yang di-deploy")

# Env aplikasi dari container lama (tanpa variabel bawaan image), lalu LLM_* baru bila ada.
IMAGE_VARS = ("PATH", "NODE_VERSION", "YARN_VERSION", "HOSTNAME", "NODE_ENV", "NEXT_TELEMETRY_DISABLED")
env = {}
for e in old["Config"]["Env"]:
    k, _, v = e.partition("=")
    if k not in IMAGE_VARS:
        env[k] = v
for k in ("LLM_URL", "LLM_MODEL", "LLM_KEY"):
    v = os.environ.get("NEW_" + k, "")
    if v:
        env[k] = v
env["PORT"] = "3032"  # Dockerfile default 3000; pemetaan port memakai 3032
print("env dibawa:", ", ".join(sorted(env)))  # nama saja, tanpa nilai

hc = old["HostConfig"]
net = next(iter(old["NetworkSettings"]["Networks"]))
aliases = [a for a in (old["NetworkSettings"]["Networks"][net].get("Aliases") or []) if a] or ["dispar-v2"]
spec = {
    "Image": IMAGE,
    "Env": [f"{k}={v}" for k, v in env.items()],
    "ExposedPorts": {"3032/tcp": {}},
    "HostConfig": {
        "PortBindings": hc["PortBindings"],
        "RestartPolicy": hc["RestartPolicy"],
        "Memory": hc.get("Memory") or 0,
        "LogConfig": hc.get("LogConfig") or {"Type": "json-file", "Config": {}},
    },
    "NetworkingConfig": {"EndpointsConfig": {net: {"Aliases": aliases}}},
}

# Sisa percobaan gagal sebelumnya.
api("DELETE", "/containers/dispar-v2-next?force=1", ok=(204, 404))
api("POST", "/containers/create?name=dispar-v2-next", spec)
rollback = f"dispar-v2-rollback-{SHA}"
api("DELETE", f"/containers/{rollback}?force=1", ok=(204, 404))

print(f"stop dispar-v2 ({old_image}) → {rollback}")
api("POST", "/containers/dispar-v2/stop?t=10")
api("POST", f"/containers/dispar-v2/rename?name={rollback}")
api("POST", "/containers/dispar-v2-next/rename?name=dispar-v2")
api("POST", "/containers/dispar-v2/start")

if healthy():
    print(f"DEPLOY OK: dispar-v2 = {IMAGE}; rollback siap di {rollback} ({old_image})")
    sys.exit(0)

print("ROLLBACK: mengembalikan container lama")
api("POST", "/containers/dispar-v2/stop?t=5")
api("POST", f"/containers/dispar-v2/rename?name=dispar-v2-gagal-{SHA}")
api("POST", f"/containers/{rollback}/rename?name=dispar-v2")
api("POST", "/containers/dispar-v2/start")
print("rollback", "OK" if healthy() else "JUGA GAGAL — periksa manual sekarang")
sys.exit(1)
PY
