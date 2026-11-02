#!/usr/bin/env bash
# Deploy Data API (lakehouse/data-api) ke produksi sebagai container mandiri `dispar-data-api`
# (plan 06 bagian B). Pola sama dengan scripts/deploy-v2.sh:
#   1. build image dispar-data-api:<sha> di LAPTOP dari commit HEAD
#   2. smoke test lokal mode produksi melawan ClickHouse server (akun read-only dari
#      platform-v2/.env.local): /v1/health 200, tanpa token 401, dengan token 200, /docs 404
#   3. cek server (hanya baca): network lakenet, port 13040, kredensial ClickHouse di dispar-v2
#   --cek berhenti di sini; tidak ada yang berubah di server.
#   4. kirim image (images/load lewat Portainer)
#   5. buat/swap container: env ClickHouse disalin dari container dispar-v2 (akun dispar_app),
#      DATA_API_TOKENS dari pemanggil (deploy pertama) atau dari container lama; lama →
#      dispar-data-api-rollback-<sha>; verifikasi dari dalam server; gagal → swap balik
#
# Pakai:
#   scripts/deploy-data-api.sh --cek
#   DATA_API_TOKENS='kominfo:<sha256>,dagster:<sha256>' scripts/deploy-data-api.sh   # deploy pertama
#   scripts/deploy-data-api.sh                                                        # update
# Token mentah tidak pernah lewat skrip ini: hanya hash sha256 (lihat plan 06, "Token").
#
# Butuh: docker lokal, python3, curl, PORTAINER_KEY (env, atau PORTAINER_API_KEY di
# .env.portainer.local). Tidak pernah mencetak nilai env.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

CEK=""
[[ "${1:-}" == "--cek" ]] && CEK=1

PORTAINER_URL="${PORTAINER_URL_V2:-https://192.168.18.148:9443}"
ENDPOINT="${PORTAINER_ENDPOINT:-3}"
HOST="${DEPLOY_HOST:-192.168.18.148}"
SHA="$(git rev-parse --short HEAD)"
IMAGE="dispar-data-api:${SHA}"

if [[ -z "${PORTAINER_KEY:-}" && -f "$ROOT/.env.portainer.local" ]]; then
  PORTAINER_KEY="$(grep -E '^PORTAINER_API_KEY=' "$ROOT/.env.portainer.local" | head -1 | cut -d= -f2- | tr -d "\"'")"
fi
[[ -n "${PORTAINER_KEY:-}" ]] || { echo "PORTAINER_KEY tidak ada (env atau .env.portainer.local)"; exit 1; }
export PORTAINER_URL ENDPOINT HOST SHA IMAGE PORTAINER_KEY CEK
export NEW_TOKENS="${DATA_API_TOKENS:-}"

step() { printf '\n== %s\n' "$*"; }

step "0. Prasyarat"
git fetch -q origin main
if ! git merge-base --is-ancestor HEAD origin/main; then
  if [[ -n "$CEK" ]]; then
    echo "catatan: HEAD ($SHA) belum ada di origin/main (boleh untuk --cek, wajib untuk deploy)"
  else
    echo "HEAD ($SHA) belum ada di origin/main. Merge/push dulu."; exit 1
  fi
fi
curl -sk -m 10 -o /dev/null -H "X-API-Key: $PORTAINER_KEY" "$PORTAINER_URL/api/status" \
  || { echo "Portainer $PORTAINER_URL tidak bisa dihubungi"; exit 1; }
echo "commit $SHA, image $IMAGE, Portainer $PORTAINER_URL (endpoint $ENDPOINT)"

step "1. Build image lokal dari commit $SHA"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git archive "$SHA" lakehouse/data-api | tar -x -C "$TMP"
docker build -q -t "$IMAGE" "$TMP/lakehouse/data-api"

step "2. Smoke test lokal (mode produksi, ClickHouse server, token sekali pakai)"
SMOKE_TOKEN="$(head -c 24 /dev/urandom | base64 | tr -d '/+=')"
SMOKE_ENV=(-e DATA_API_ENV=produksi -e "CH_URL=http://$HOST:18123"
  -e "DATA_API_TOKENS=smoke:$(printf %s "$SMOKE_TOKEN" | sha256sum | cut -c1-64)")
[[ -f platform-v2/.env.local ]] || { echo "platform-v2/.env.local tidak ada (akun read-only untuk smoke test)"; exit 1; }
while IFS='=' read -r k v; do
  v="${v#[\"\']}"; v="${v%[\"\']}"   # hanya kutip pembungkus, bukan isi sandi
  SMOKE_ENV+=(-e "$k=$v")
done < <(grep -E '^CH_(USER|PASSWORD)=' platform-v2/.env.local)
CID="$(docker run -d --rm -p 13499:8080 "${SMOKE_ENV[@]}" "$IMAGE")"
kode() { curl -s -m 30 -o /dev/null -w '%{http_code}' "$@" || true; }
ok=""
for _ in $(seq 1 30); do
  [[ "$(kode http://localhost:13499/v1/health)" == "200" ]] && { ok=1; break; }
  sleep 2
done
hasil=""
if [[ -n "$ok" ]]; then
  t401="$(kode http://localhost:13499/v1/katalog)"
  t200="$(kode -H "Authorization: Bearer $SMOKE_TOKEN" http://localhost:13499/v1/katalog)"
  docs="$(kode http://localhost:13499/docs)"
  oapi="$(kode http://localhost:13499/openapi.json)"
  hasil="tanpa token $t401, dengan token $t200, /docs $docs, /openapi.json $oapi"
  [[ "$t401" == 401 && "$t200" == 200 && "$docs" == 404 && "$oapi" == 404 ]] || ok=""
fi
docker stop "$CID" >/dev/null || true
[[ -n "$ok" ]] || { echo "Smoke test gagal (${hasil:-health tidak 200})"; exit 1; }
echo "smoke test OK: $hasil"

step "3. Cek server (hanya baca)"
python3 - <<'PY'
import json, os, ssl, sys, urllib.request, urllib.error
BASE = f"{os.environ['PORTAINER_URL']}/api/endpoints/{os.environ['ENDPOINT']}/docker"
CTX = ssl._create_unverified_context()
def get(path):
    req = urllib.request.Request(BASE + path, headers={"X-API-Key": os.environ["PORTAINER_KEY"]})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise SystemExit(f"Docker API GET {path} → {e.code}")
masalah = []
if get("/networks/dispar-lakehouse_lakenet") is None:
    masalah.append("network dispar-lakehouse_lakenet tidak ada")
v2 = get("/containers/dispar-v2/json")
kunci = {e.partition("=")[0] for e in (v2 or {}).get("Config", {}).get("Env", [])}
if not {"CH_USER", "CH_PASSWORD"} <= kunci:
    masalah.append("dispar-v2 tidak membawa CH_USER/CH_PASSWORD")
lama = get("/containers/dispar-data-api/json")
pemakai = [c["Names"][0] for c in get("/containers/json?all=1")
           if any(p.get("PublicPort") == 13040 for p in c.get("Ports", [])) and c["Names"][0] != "/dispar-data-api"]
if pemakai:
    masalah.append(f"port 13040 dipakai {pemakai}")
if lama is None and not os.environ.get("NEW_TOKENS"):
    if os.environ.get("CEK"):
        print("catatan: deploy pertama butuh DATA_API_TOKENS (hash)")
    else:
        masalah.append("deploy pertama: DATA_API_TOKENS (hash) wajib diisi")
print("container lama:", lama["Config"]["Image"] if lama else "belum ada (deploy pertama)")
if masalah:
    raise SystemExit("STOP: " + "; ".join(masalah))
print("cek server OK")
PY
if [[ -n "$CEK" ]]; then
  echo; echo "--cek selesai: tidak ada yang diubah di server."; exit 0
fi

step "4. Kirim image ke server (images/load)"
docker save "$IMAGE" | curl -sk --fail -m 900 -X POST \
  -H "X-API-Key: $PORTAINER_KEY" -H "Content-Type: application/x-tar" \
  --data-binary @- "$PORTAINER_URL/api/endpoints/$ENDPOINT/docker/images/load?quiet=1" >/dev/null
echo "image terkirim"

step "5. Buat/swap container + verifikasi"
python3 - <<'PY'
import json, os, ssl, sys, time, urllib.request, urllib.error

BASE = f"{os.environ['PORTAINER_URL']}/api/endpoints/{os.environ['ENDPOINT']}/docker"
KEY, SHA, IMAGE = os.environ["PORTAINER_KEY"], os.environ["SHA"], os.environ["IMAGE"]
CTX = ssl._create_unverified_context()
NAMA = "dispar-data-api"

def api(method, path, body=None, ok=(200, 201, 204, 304), mentah=False):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"X-API-Key": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=120) as r:
            raw = r.read()
            if mentah:
                return raw
            return json.loads(raw) if raw.strip()[:1] in (b"{", b"[") else None
    except urllib.error.HTTPError as e:
        if e.code in ok:
            return None
        raise SystemExit(f"Docker API {method} {path} → {e.code}: {e.read()[:300]!r}")

def sehat(nama):
    """Health Docker container (HEALTHCHECK python di spec) — dicek dari server, bukan laptop."""
    for _ in range(40):
        s = api("GET", f"/containers/{nama}/json")["State"]
        h = (s.get("Health") or {}).get("Status")
        if h == "healthy":
            return True
        if not s.get("Running"):
            break
        time.sleep(3)
    print(f"verifikasi gagal: status {s.get('Status')}, health {h}")
    return False

v2 = api("GET", "/containers/dispar-v2/json")
ch = {k: v for k, _, v in (e.partition("=") for e in v2["Config"]["Env"]) if k in ("CH_URL", "CH_USER", "CH_PASSWORD")}
lama = api("GET", f"/containers/{NAMA}/json", ok=(404,))
token = os.environ.get("NEW_TOKENS") or next(
    (e.partition("=")[2] for e in (lama or {}).get("Config", {}).get("Env", []) if e.startswith("DATA_API_TOKENS=")), "")
if not token:
    sys.exit("DATA_API_TOKENS kosong (isi untuk deploy pertama)")
if lama and lama["Config"]["Image"] == IMAGE and not os.environ.get("NEW_TOKENS"):
    sys.exit(f"{NAMA} sudah memakai {IMAGE} — tidak ada yang di-deploy")

# Koneksi ClickHouse sama dengan dispar-v2 (akun read-only dispar_app); alamat bawaan bila tak ada.
env = {"CH_URL": "http://lake-clickhouse:8123", **ch, "DATA_API_TOKENS": token, "DATA_API_ENV": "produksi"}
print("env:", ", ".join(sorted(env)))  # nama saja
spec = {
    "Image": IMAGE,
    "Env": [f"{k}={v}" for k, v in env.items()],
    "ExposedPorts": {"8080/tcp": {}},
    "Healthcheck": {
        "Test": ["CMD", "python", "-c",
                 "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8080/v1/health',timeout=5)"],
        "Interval": 30_000_000_000, "Timeout": 10_000_000_000, "Retries": 3, "StartPeriod": 20_000_000_000,
    },
    "HostConfig": {
        "PortBindings": {"8080/tcp": [{"HostPort": "13040"}]},
        "RestartPolicy": {"Name": "unless-stopped"},
        "Memory": 512 * 1024 * 1024,
        "LogConfig": {"Type": "json-file", "Config": {"max-size": "20m", "max-file": "3"}},
    },
    "NetworkingConfig": {"EndpointsConfig": {"dispar-lakehouse_lakenet": {"Aliases": [NAMA]}}},
}

rollback = f"{NAMA}-rollback-{SHA}"
api("DELETE", f"/containers/{NAMA}-next?force=1", ok=(204, 404))
api("DELETE", f"/containers/{NAMA}-gagal-{SHA}?force=1", ok=(204, 404))
api("POST", f"/containers/create?name={NAMA}-next", spec)
if lama:
    api("DELETE", f"/containers/{rollback}?force=1", ok=(204, 404))
    print(f"stop {NAMA} ({lama['Config']['Image']}) → {rollback}")
    api("POST", f"/containers/{NAMA}/stop?t=10")
    api("POST", f"/containers/{NAMA}/rename?name={rollback}")
api("POST", f"/containers/{NAMA}-next/rename?name={NAMA}")
api("POST", f"/containers/{NAMA}/start")

if sehat(NAMA):
    print(f"DEPLOY OK: {NAMA} = {IMAGE}" + (f"; rollback siap di {rollback}" if lama else " (deploy pertama)"))
    sys.exit(0)

print("GAGAL: log terakhir:")
print(api("GET", f"/containers/{NAMA}/logs?stdout=1&stderr=1&tail=30", mentah=True)[-3000:].decode("utf-8", "replace"))
api("POST", f"/containers/{NAMA}/stop?t=5", ok=(204, 304))
api("POST", f"/containers/{NAMA}/rename?name={NAMA}-gagal-{SHA}")
if lama:
    api("POST", f"/containers/{rollback}/rename?name={NAMA}")
    api("POST", f"/containers/{NAMA}/start")
    print("rollback", "OK" if sehat(NAMA) else "JUGA GAGAL — periksa manual sekarang")
sys.exit(1)
PY
