#!/usr/bin/env bash
# Ganti image container mandiri `lake-dagster` (plan 06 bagian A). Pola sama dengan
# scripts/deploy-v2.sh; menuliskan prosedur yang sebelumnya dijalankan lewat helper docker:27-dind:
#   1. build image dispar-lake-dagster:<sha> di LAPTOP lewat lakehouse/scripts/build-dagster-image.sh
#      (lakehouse/ + berkas registri sources.toml dari git archive HEAD)
#   2. cek server (hanya baca): container lama, tidak ada run Dagster yang sedang berjalan
#   --cek berhenti di sini; tidak ada yang berubah di server.
#   3. kirim image (images/load lewat Portainer)
#   4. buat lake-dagster-next dengan config container lama (env, volume /opt/dagster, port, network,
#      alias), + DATA_API_FLUSH_TOKEN bila diberikan; lama → lake-dagster-rollback-<sha>;
#      verifikasi /server_info; gagal → swap balik
#
# Pakai:
#   scripts/deploy-dagster.sh --cek
#   DATA_API_FLUSH_TOKEN=<token mentah klien dagster> scripts/deploy-dagster.sh
#   scripts/deploy-dagster.sh            # tanpa token baru → token di container lama dibawa apa adanya
#
# Jangan jalankan bersamaan dengan refresh_lakehouse (skrip menolak bila ada run aktif) atau deploy
# dispar-v2. Volume /opt/dagster dipakai ulang, jadi jadwal dan riwayat run tetap.
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
IMAGE="dispar-lake-dagster:${SHA}"

if [[ -z "${PORTAINER_KEY:-}" && -f "$ROOT/.env.portainer.local" ]]; then
  PORTAINER_KEY="$(grep -E '^PORTAINER_API_KEY=' "$ROOT/.env.portainer.local" | head -1 | cut -d= -f2- | tr -d "\"'")"
fi
[[ -n "${PORTAINER_KEY:-}" ]] || { echo "PORTAINER_KEY tidak ada (env atau .env.portainer.local)"; exit 1; }
export PORTAINER_URL ENDPOINT HOST SHA IMAGE PORTAINER_KEY CEK
export NEW_FLUSH_TOKEN="${DATA_API_FLUSH_TOKEN:-}"

step() { printf '\n== %s\n' "$*"; }

# Dipakai dua kali: di cek server dan tepat sebelum swap (run terjadwal bisa mulai di antaranya).
cek_run_aktif() {
  python3 - <<'PY'
import json, os, urllib.request
q = {"query": "{ runsOrError(filter:{statuses:[STARTED,STARTING,QUEUED]}) { __typename ... on Runs { results { jobName status } } } }"}
req = urllib.request.Request(f"http://{os.environ['HOST']}:13030/graphql", data=json.dumps(q).encode(),
                             headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        aktif = json.load(r)["data"]["runsOrError"]["results"]
except Exception as e:
    raise SystemExit(f"STOP: status run Dagster tidak terbaca ({e!r})")
if aktif:
    raise SystemExit(f"STOP: ada run Dagster aktif {[(a['jobName'], a['status']) for a in aktif]}")
print("tidak ada run Dagster aktif")
PY
}

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
lakehouse/scripts/build-dagster-image.sh "$IMAGE" >/dev/null
docker run --rm --entrypoint python "$IMAGE" -c \
  "import dispar_orchestrate.definitions as d; assert 'flush_data_api' in {a.key.to_user_string() for a in d.defs.assets}; print('definisi Dagster termuat')"

step "2. Cek server (hanya baca)"
python3 - <<'PY'
import json, os, ssl, urllib.request, urllib.error
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
lama = get("/containers/lake-dagster/json")
if lama is None or not lama["State"]["Running"]:
    raise SystemExit("STOP: container lake-dagster tidak ada atau tidak jalan")
kunci = {e.partition("=")[0] for e in lama["Config"]["Env"]}
print("image lama:", lama["Config"]["Image"], "| DATA_API_FLUSH_TOKEN di container lama:", "ada" if "DATA_API_FLUSH_TOKEN" in kunci else "belum")
print("cek container OK")
PY
cek_run_aktif
if [[ -n "$CEK" ]]; then
  echo; echo "--cek selesai: tidak ada yang diubah di server."; exit 0
fi

step "3. Kirim image ke server (images/load)"
docker save "$IMAGE" | curl -sk --fail -m 1800 -X POST \
  -H "X-API-Key: $PORTAINER_KEY" -H "Content-Type: application/x-tar" \
  --data-binary @- "$PORTAINER_URL/api/endpoints/$ENDPOINT/docker/images/load?quiet=1" >/dev/null
echo "image terkirim"

step "4. Swap container + verifikasi"
cek_run_aktif   # sekali lagi tepat sebelum swap
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
            return json.loads(raw) if raw.strip()[:1] in (b"{", b"[") else None
    except urllib.error.HTTPError as e:
        if e.code in ok:
            return None
        raise SystemExit(f"Docker API {method} {path} → {e.code}: {e.read()[:300]!r}")

def sehat():
    for _ in range(60):
        try:
            with urllib.request.urlopen(f"http://{HOST}:13030/server_info", timeout=10) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(3)
    print("verifikasi gagal: /server_info tidak 200 dalam 180 dtk")
    return False

old = api("GET", "/containers/lake-dagster/json")
old_image = old["Config"]["Image"]
if old_image == IMAGE and not os.environ.get("NEW_FLUSH_TOKEN"):
    sys.exit(f"lake-dagster sudah memakai {IMAGE} — tidak ada yang di-deploy")

# Env aplikasi dari container lama (tanpa variabel bawaan image baru), lalu token flush baru bila ada.
img_env = {e.partition("=")[0] for e in api("GET", f"/images/{IMAGE}/json")["Config"]["Env"]}
env = {k: v for k, _, v in (e.partition("=") for e in old["Config"]["Env"]) if k not in img_env}
if os.environ.get("NEW_FLUSH_TOKEN"):
    env["DATA_API_FLUSH_TOKEN"] = os.environ["NEW_FLUSH_TOKEN"]
print("env dibawa:", ", ".join(sorted(env)))  # nama saja

hc = old["HostConfig"]
net = next(iter(old["NetworkSettings"]["Networks"]))
aliases = [a for a in (old["NetworkSettings"]["Networks"][net].get("Aliases") or []) if a] or ["lake-dagster"]
spec = {
    "Image": IMAGE,
    "Env": [f"{k}={v}" for k, v in env.items()],
    "ExposedPorts": {"3030/tcp": {}},
    "HostConfig": {
        "Binds": hc.get("Binds") or [],
        "PortBindings": hc["PortBindings"],
        "RestartPolicy": hc["RestartPolicy"],
        "Memory": hc.get("Memory") or 0,
        "LogConfig": hc.get("LogConfig") or {"Type": "json-file", "Config": {}},
    },
    "NetworkingConfig": {"EndpointsConfig": {net: {"Aliases": aliases}}},
}

rollback = f"lake-dagster-rollback-{SHA}"
api("DELETE", "/containers/lake-dagster-next?force=1", ok=(204, 404))
api("DELETE", f"/containers/lake-dagster-gagal-{SHA}?force=1", ok=(204, 404))
api("DELETE", f"/containers/{rollback}?force=1", ok=(204, 404))
api("POST", "/containers/create?name=lake-dagster-next", spec)
print(f"stop lake-dagster ({old_image}) → {rollback}")
api("POST", "/containers/lake-dagster/stop?t=60")
api("POST", f"/containers/lake-dagster/rename?name={rollback}")
api("POST", "/containers/lake-dagster-next/rename?name=lake-dagster")
api("POST", "/containers/lake-dagster/start")

if sehat():
    print(f"DEPLOY OK: lake-dagster = {IMAGE}; rollback siap di {rollback} ({old_image})")
    sys.exit(0)

print("ROLLBACK: mengembalikan container lama")
api("POST", "/containers/lake-dagster/stop?t=30")
api("POST", f"/containers/lake-dagster/rename?name=lake-dagster-gagal-{SHA}")
api("POST", f"/containers/{rollback}/rename?name=lake-dagster")
api("POST", "/containers/lake-dagster/start")
print("rollback", "OK" if sehat() else "JUGA GAGAL — periksa manual sekarang")
sys.exit(1)
PY
