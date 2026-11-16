#!/usr/bin/env bash
# Deploy portal (port/: Laravel + Nuxt) ke server 192.168.18.148 untuk uji coba, sebelum pindah ke
# server Kominfo. Pola sama dengan scripts/deploy-data-api.sh:
#   1. build image dispar-portal-backend:<sha> dan dispar-portal-frontend:<sha> di LAPTOP dari HEAD
#      (konteks port/, Dockerfile di port/deploy/)
#   2. cek server (hanya baca): network lakenet, container dispar-data-api, port 13041, token Data API
#      --cek berhenti di sini; tidak ada yang berubah di server.
#   3. kirim kedua image (images/load lewat Portainer)
#   4. Oracle: container dispar-portal-oracle (XE 18, volume dispar-portal-oracle-data, tanpa port
#      host) dibuat bila belum ada; sandinya dibangkitkan sekali dan hanya hidup di env container
#   5. migrate lewat container sekali jalan; deploy pertama juga: seed akun layanan, token frontend
#      (masuk env Nuxt) dan token admin (disimpan di ~/.dispar-rahasia/portal-admin)
#   6. swap dispar-portal-backend, -scheduler, -frontend (lama → <nama>-rollback-<versi lama>);
#      verifikasi backend healthy dan frontend :13041 → 200; gagal (termasuk galat API) → swap balik
#   Berhenti sebelum mengubah apa pun bila ada run Dagster aktif atau Oracle hilang sementara
#   backend masih ada.
#
# Pakai:
#   scripts/deploy-portal.sh --cek
#   scripts/deploy-portal.sh                                   # deploy pertama / update
#   PORTAL_URL=https://<hostname> scripts/deploy-portal.sh     # setelah hostname publik ada
# Deploy pertama butuh token Data API mentah di ~/.dispar-rahasia/data-api-portal (plan 06,
# "Token"); berikutnya env diambil dari container lama. Migrasi tidak ikut di-rollback.
#
# Butuh: docker lokal, python3, curl, PORTAINER_KEY (env, atau PORTAINER_API_KEY di
# .env.portainer.local). Tidak pernah mencetak nilai env.
set -euo pipefail
umask 022   # berkas hasil git archive harus terbaca user non-root di image

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

CEK=""
[[ "${1:-}" == "--cek" ]] && CEK=1

PORTAINER_URL="${PORTAINER_URL_V2:-https://192.168.18.148:9443}"
ENDPOINT="${PORTAINER_ENDPOINT:-3}"
HOST="${DEPLOY_HOST:-192.168.18.148}"
SHA="$(git rev-parse --short HEAD)"
IMG_BE="dispar-portal-backend:${SHA}"
IMG_FE="dispar-portal-frontend:${SHA}"
TOKEN_DATA_API="${DATA_API_TOKEN_BERKAS:-$HOME/.dispar-rahasia/data-api-portal}"
TOKEN_ADMIN="${PORTAL_ADMIN_BERKAS:-$HOME/.dispar-rahasia/portal-admin}"

if [[ -z "${PORTAINER_KEY:-}" && -f "$ROOT/.env.portainer.local" ]]; then
  PORTAINER_KEY="$(grep -E '^PORTAINER_API_KEY=' "$ROOT/.env.portainer.local" | head -1 | cut -d= -f2- | tr -d "\"'")"
fi
[[ -n "${PORTAINER_KEY:-}" ]] || { echo "PORTAINER_KEY tidak ada (env atau .env.portainer.local)"; exit 1; }
export PORTAINER_URL ENDPOINT HOST SHA IMG_BE IMG_FE PORTAINER_KEY CEK TOKEN_DATA_API TOKEN_ADMIN
export PORTAL_URL="${PORTAL_URL:-}"

step() { printf '\n== %s\n' "$*"; }

step "0. Prasyarat"
git fetch -q origin
if [[ -z "$(git branch -r --contains HEAD)" ]]; then
  if [[ -n "$CEK" ]]; then
    echo "catatan: HEAD ($SHA) belum di-push (boleh untuk --cek, wajib untuk deploy)"
  else
    echo "HEAD ($SHA) belum ada di remote mana pun. Push dulu."; exit 1
  fi
fi
[[ -z "$(git status --porcelain -- port)" ]] || echo "catatan: ada perubahan belum di-commit di port/ — image dibangun dari commit $SHA, bukan dari berkas kerja"
curl -sk -m 10 -o /dev/null -H "X-API-Key: $PORTAINER_KEY" "$PORTAINER_URL/api/status" \
  || { echo "Portainer $PORTAINER_URL tidak bisa dihubungi"; exit 1; }
echo "commit $SHA, image $IMG_BE + $IMG_FE, Portainer $PORTAINER_URL (endpoint $ENDPOINT)"

step "1. Build image lokal dari commit $SHA"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
git archive "$SHA" port | tar -x -C "$TMP"
docker build -q -t "$IMG_BE" -f "$TMP/port/deploy/backend.Dockerfile" "$TMP/port"
docker build -q -t "$IMG_FE" -f "$TMP/port/deploy/frontend.Dockerfile" "$TMP/port"

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
masalah = []
if get("/networks/dispar-lakehouse_lakenet") is None:
    masalah.append("network dispar-lakehouse_lakenet tidak ada")
api = get("/containers/dispar-data-api/json")
if not (api and api["State"].get("Running")):
    masalah.append("container dispar-data-api tidak jalan (deploy dulu: scripts/deploy-data-api.sh)")
pemakai = [c["Names"][0] for c in get("/containers/json?all=1")
           if any(p.get("PublicPort") == 13041 for p in c.get("Ports", [])) and c["Names"][0] != "/dispar-portal-frontend"]
if pemakai:
    masalah.append(f"port 13041 dipakai {pemakai}")
be = get("/containers/dispar-portal-backend/json")
if be is None and not os.path.isfile(os.environ["TOKEN_DATA_API"]):
    masalah.append(f"deploy pertama: token Data API mentah tidak ada di {os.environ['TOKEN_DATA_API']}")
ora = get("/containers/dispar-portal-oracle/json")
if ora is None and be is not None:
    masalah.append("dispar-portal-oracle tidak ada padahal backend ada: Oracle baru = skema kosong dan sandi "
                   "beda dari env backend; pulihkan Oracle atau hapus container portal dulu")
# Deploy lewat Portainer pernah timeout saat refresh_lakehouse berjalan (lihat deploy-dagster.sh).
q = b'{"query":"{ runsOrError(filter:{statuses:[STARTED,QUEUED,STARTING]}, limit:1) { ... on Runs { results { runId jobName } } } }"}'
try:
    req = urllib.request.Request(f"http://{os.environ['HOST']}:13030/graphql", data=q,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=20) as r:
        aktif = json.load(r)["data"]["runsOrError"]["results"]
    if aktif:
        masalah.append(f"run Dagster aktif ({aktif[0]['jobName']} {aktif[0]['runId'][:8]}); tunggu selesai")
except (OSError, KeyError, TypeError, ValueError) as e:
    print(f"catatan: status run Dagster tidak terbaca ({e}); pastikan tidak ada refresh berjalan")
print("oracle:", "ada" if ora else "belum ada (dibuat saat deploy)")
print("backend lama:", be["Config"]["Image"] if be else "belum ada (deploy pertama)")
if masalah:
    raise SystemExit("STOP: " + "; ".join(masalah))
print("cek server OK")
PY
if [[ -n "$CEK" ]]; then
  echo; echo "--cek selesai: tidak ada yang diubah di server."; exit 0
fi

step "3. Kirim image ke server (images/load)"
for img in "$IMG_BE" "$IMG_FE"; do
  docker save "$img" | curl -sk --fail -m 1800 -X POST \
    -H "X-API-Key: $PORTAINER_KEY" -H "Content-Type: application/x-tar" \
    --data-binary @- "$PORTAINER_URL/api/endpoints/$ENDPOINT/docker/images/load?quiet=1" >/dev/null
  echo "terkirim: $img"
done

step "4–6. Oracle, migrasi, swap container + verifikasi"
python3 - <<'PY'
import base64, json, os, secrets, ssl, sys, time, urllib.request, urllib.error

BASE = f"{os.environ['PORTAINER_URL']}/api/endpoints/{os.environ['ENDPOINT']}/docker"
KEY, SHA, HOST = os.environ["PORTAINER_KEY"], os.environ["SHA"], os.environ["HOST"]
IMG_BE, IMG_FE = os.environ["IMG_BE"], os.environ["IMG_FE"]
CTX = ssl._create_unverified_context()
NET = "dispar-lakehouse_lakenet"
ORA, BE, SCH, FE = "dispar-portal-oracle", "dispar-portal-backend", "dispar-portal-scheduler", "dispar-portal-frontend"
ORA_IMG = "gvenzl/oracle-xe:18-slim"
LOG = {"Type": "json-file", "Config": {"max-size": "20m", "max-file": "3"}}

def api(method, path, body=None, ok=(200, 201, 204, 304), mentah=False, timeout=120):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"X-API-Key": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, context=CTX, timeout=timeout) as r:
            raw = r.read()
            if mentah:
                return raw
            return json.loads(raw) if raw.strip()[:1] in (b"{", b"[") else None
    except urllib.error.HTTPError as e:
        if e.code in ok:
            return None
        raise SystemExit(f"Docker API {method} {path} → {e.code}: {e.read()[:300]!r}")

def env_dari(c):
    return dict(e.partition("=")[::2] for e in (c or {}).get("Config", {}).get("Env", []))

def tunggu_sehat(nama, kali=60, jeda=5):
    for _ in range(kali):
        s = api("GET", f"/containers/{nama}/json")["State"]
        h = (s.get("Health") or {}).get("Status")
        if h == "healthy":
            return True
        if not s.get("Running"):
            break
        time.sleep(jeda)
    print(f"{nama} tidak sehat: status {s.get('Status')}, health {h}")
    return False

def jaringan(alias):
    return {"EndpointsConfig": {NET: {"Aliases": [alias]}}}

# ---------- 4. Oracle ----------
ora = api("GET", f"/containers/{ORA}/json", ok=(404,))
if ora is None:
    # nama image tanpa di-encode: Portainer menolak (403) path /images/<nama%2F...>
    if api("GET", f"/images/{ORA_IMG}/json", ok=(404,)) is None:
        print(f"tarik image {ORA_IMG} di server (sekali, ±2 GB)")
        repo, tag = ORA_IMG.split(":")
        api("POST", f"/images/create?fromImage={repo}&tag={tag}", mentah=True, timeout=1800)
    # Sandi Oracle maksimal 30 karakter (lebih panjang → ORA-00972 dan user app tidak dibuat);
    # diawali huruf, sisanya heksadesimal: 25 karakter.
    sandi = {"ORACLE_PASSWORD": "p" + secrets.token_hex(12),
             "APP_USER": "portal",
             "APP_USER_PASSWORD": "p" + secrets.token_hex(12)}
    api("POST", f"/containers/create?name={ORA}", {
        "Image": ORA_IMG,
        "Env": [f"{k}={v}" for k, v in sandi.items()],
        # Image gvenzl tidak membawa HEALTHCHECK; sama dengan compose.dev.yaml.
        "Healthcheck": {"Test": ["CMD", "healthcheck.sh"], "Interval": 10_000_000_000,
                        "Timeout": 5_000_000_000, "Retries": 60, "StartPeriod": 60_000_000_000},
        "HostConfig": {"Binds": ["dispar-portal-oracle-data:/opt/oracle/oradata"],
                       "RestartPolicy": {"Name": "unless-stopped"},
                       "Memory": 4 * 1024**3, "LogConfig": LOG},
        "NetworkingConfig": jaringan(ORA),
    })
    print(f"{ORA} dibuat")
    ora = api("GET", f"/containers/{ORA}/json")
if not ora["State"].get("Running"):
    api("POST", f"/containers/{ORA}/start")
if not tunggu_sehat(ORA, kali=240):  # init pertama di 148 bisa >10 menit
    sys.exit("STOP: Oracle tidak sehat; tidak ada container portal yang diubah")
print("oracle sehat")
ora_env = env_dari(api("GET", f"/containers/{ORA}/json"))

# ---------- env aplikasi ----------
be_lama = api("GET", f"/containers/{BE}/json", ok=(404,))
fe_lama = api("GET", f"/containers/{FE}/json", ok=(404,))
pertama = be_lama is None
url = os.environ.get("PORTAL_URL") or ""
net = api("GET", f"/networks/{NET}")
subnet = net["IPAM"]["Config"][0]["Subnet"]

KUNCI_BE = ["APP_NAME", "APP_ENV", "APP_DEBUG", "APP_KEY", "APP_URL", "LOG_CHANNEL", "LOG_LEVEL",
            "DB_CONNECTION", "DB_HOST", "DB_PORT", "DB_SERVICE_NAME", "DB_SERVER_VERSION", "DB_USERNAME",
            "DB_PASSWORD", "CACHE_DRIVER", "DATA_API_URL", "DATA_API_TOKEN", "PORTAL_VERSI",
            "PORTAL_PROXY_TEPERCAYA", "PORTAL_BATAS_PER_MENIT", "PORTAL_JAM_SINKRON",
            "PORTAL_SNAPSHOT_BASI_JAM", "PORTAL_SEGARKAN_JEDA_MENIT", "PORTAL_CACHE_MENIT",
            "LOG_HISTORY_AKTIF", "LOG_HISTORY_RETENSI_HARI"]
if pertama:
    with open(os.environ["TOKEN_DATA_API"]) as f:
        token_api = f.read().strip()
    env_be = {
        "APP_NAME": "Portal Disparekraf", "APP_ENV": "production", "APP_DEBUG": "false",
        "APP_KEY": "base64:" + base64.b64encode(secrets.token_bytes(32)).decode(),
        "APP_URL": url or f"http://{HOST}:13041",
        "LOG_CHANNEL": "stderr", "LOG_LEVEL": "info",
        "DB_CONNECTION": "oracle", "DB_HOST": ORA, "DB_PORT": "1521", "DB_SERVICE_NAME": "XEPDB1",
        "DB_SERVER_VERSION": "12c", "DB_USERNAME": ora_env["APP_USER"], "DB_PASSWORD": ora_env["APP_USER_PASSWORD"],
        "CACHE_DRIVER": "database",
        "DATA_API_URL": "http://dispar-data-api:8080", "DATA_API_TOKEN": token_api,
        "PORTAL_PROXY_TEPERCAYA": subnet, "PORTAL_BATAS_PER_MENIT": "120", "PORTAL_JAM_SINKRON": "11:00",
        "PORTAL_SNAPSHOT_BASI_JAM": "36", "PORTAL_SEGARKAN_JEDA_MENIT": "5", "PORTAL_CACHE_MENIT": "15",
        "LOG_HISTORY_AKTIF": "true", "LOG_HISTORY_RETENSI_HARI": "180",
    }
else:
    lama = env_dari(be_lama)
    env_be = {k: lama[k] for k in KUNCI_BE if k in lama}
    kurang = {"APP_KEY", "DB_PASSWORD", "DATA_API_TOKEN"} - env_be.keys()
    if kurang:
        sys.exit(f"STOP: env {BE} lama tidak memuat {sorted(kurang)}; tidak ada yang diubah")
    if url:
        env_be["APP_URL"] = url
env_be["PORTAL_VERSI"] = SHA
print("env backend:", ", ".join(sorted(env_be)))  # nama saja

def tugas(perintah, nama):
    """Jalankan perintah artisan di container sekali jalan (image baru); kembalikan keluarannya."""
    api("DELETE", f"/containers/{nama}?force=1", ok=(204, 404))
    api("POST", f"/containers/create?name={nama}", {
        "Image": IMG_BE, "Cmd": perintah, "Tty": True,
        "Env": [f"{k}={v}" for k, v in env_be.items()],
        "Healthcheck": {"Test": ["NONE"]},
        "HostConfig": {"LogConfig": LOG}, "NetworkingConfig": jaringan(nama),
    })
    api("POST", f"/containers/{nama}/start")
    kode = api("POST", f"/containers/{nama}/wait", timeout=600)["StatusCode"]
    keluar = api("GET", f"/containers/{nama}/logs?stdout=1&stderr=1", mentah=True).decode("utf-8", "replace")
    api("DELETE", f"/containers/{nama}?force=1", ok=(204, 404))
    if kode != 0:
        # keluaran gagal tidak memuat token (perintah token baru jalan setelah migrasi lulus)
        sys.exit(f"STOP: {' '.join(perintah)} keluar {kode}; container portal tidak diubah\n{keluar[-2000:]}")
    return keluar

def token(keluar):
    baris = [b.strip() for b in keluar.splitlines() if "|" in b and b.strip().split("|")[0].isdigit()]
    if not baris:
        sys.exit("STOP: token tidak ditemukan di keluaran portal:token")
    return baris[0]

# ---------- 5. migrasi (+ seed dan token saat deploy pertama) ----------
tugas(["php", "artisan", "migrate", "--force"], "dispar-portal-tugas")
print("migrasi OK")
if pertama:
    tugas(["php", "artisan", "db:seed", "--force", "--class=App\\Shared\\Auth\\ServiceAccountSeeder"], "dispar-portal-tugas")
    token_fe = token(tugas(["php", "artisan", "portal:token", "frontend", "read"], "dispar-portal-tugas"))
    token_admin = token(tugas(["php", "artisan", "portal:token", "admin", "admin"], "dispar-portal-tugas"))
    berkas = os.environ["TOKEN_ADMIN"]
    os.makedirs(os.path.dirname(berkas), mode=0o700, exist_ok=True)
    fd = os.open(berkas, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(token_admin + "\n")
    print(f"akun layanan dibuat; token admin disimpan di {berkas}")
    env_fe = {"NUXT_LARAVEL_URL": f"http://{BE}:8080", "NUXT_FRONTEND_TOKEN": token_fe,
              "NUXT_PUBLIC_API_BASE_URL": url or f"http://{HOST}:13041"}
else:
    lama = env_dari(fe_lama)
    env_fe = {"NUXT_LARAVEL_URL": f"http://{BE}:8080", "NUXT_PUBLIC_API_BASE_URL": f"http://{HOST}:13041"}
    env_fe.update({k: lama[k] for k in env_fe.keys() | {"NUXT_FRONTEND_TOKEN"} if k in lama})
    if "NUXT_FRONTEND_TOKEN" not in env_fe:
        # container frontend lama hilang/tidak lengkap: buat token frontend baru
        env_fe["NUXT_FRONTEND_TOKEN"] = token(tugas(["php", "artisan", "portal:token", "frontend", "read"], "dispar-portal-tugas"))
        print("token frontend dibuat ulang (frontend lama tidak membawanya)")
    if url:
        env_fe["NUXT_PUBLIC_API_BASE_URL"] = url
print("env frontend:", ", ".join(sorted(env_fe)))

# ---------- 6. swap ----------
LIST_BE = [f"{k}={v}" for k, v in env_be.items()]
SPEC = {
    BE: {"Image": IMG_BE, "Env": LIST_BE,
         "HostConfig": {"RestartPolicy": {"Name": "unless-stopped"}, "Memory": 1024**3, "LogConfig": LOG},
         "NetworkingConfig": jaringan(BE)},
    SCH: {"Image": IMG_BE, "Env": LIST_BE, "Cmd": ["php", "artisan", "schedule:work"],
          "Healthcheck": {"Test": ["NONE"]},
          "HostConfig": {"Init": True, "RestartPolicy": {"Name": "unless-stopped"},
                         "Memory": 512 * 1024**2, "LogConfig": LOG},
          "NetworkingConfig": jaringan(SCH)},
    FE: {"Image": IMG_FE, "Env": [f"{k}={v}" for k, v in env_fe.items()], "ExposedPorts": {"3000/tcp": {}},
         "HostConfig": {"PortBindings": {"3000/tcp": [{"HostPort": "13041"}]},
                        "RestartPolicy": {"Name": "unless-stopped"}, "Memory": 512 * 1024**2, "LogConfig": LOG},
         "NetworkingConfig": jaringan(FE)},
}

diganti = []  # (nama, nama rollback atau None)
def pasang(nama):
    lama = api("GET", f"/containers/{nama}/json", ok=(404,))
    # Rollback dinamai menurut versi yang DISIMPANNYA (bukan versi baru), supaya deploy ulang
    # commit yang sama (mis. hanya mengganti PORTAL_URL) tidak menimpa rollback versi sebelumnya.
    rb = f"{nama}-rollback-{lama['Config']['Image'].rpartition(':')[2]}" if lama else None
    api("DELETE", f"/containers/{nama}-next?force=1", ok=(204, 404))
    api("POST", f"/containers/create?name={nama}-next", SPEC[nama])
    if lama:
        api("DELETE", f"/containers/{rb}?force=1", ok=(204, 404))
        print(f"stop {nama} ({lama['Config']['Image']}) → {rb}")
        api("POST", f"/containers/{nama}/stop?t=20", ok=(204, 304))
        api("POST", f"/containers/{nama}/rename?name={rb}")
        diganti.append((nama, rb))
    else:
        diganti.append((nama, None))
    api("POST", f"/containers/{nama}-next/rename?name={nama}")
    api("POST", f"/containers/{nama}/start")

def frontend_200():
    for _ in range(40):
        try:
            with urllib.request.urlopen(f"http://{HOST}:13041/", timeout=30) as r:
                if r.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(3)
    print("frontend :13041 tidak menjawab 200")
    return False

try:
    pasang(BE)
    ok = tunggu_sehat(BE, kali=40, jeda=3)
    if ok:
        pasang(SCH)
        pasang(FE)
        ok = frontend_200()
except SystemExit as e:  # galat Docker API di tengah swap: tetap swap balik
    print(e)
    ok = False
if ok:
    rbs = [rb for _, rb in diganti if rb]
    print(f"DEPLOY OK: portal {SHA} — http://{HOST}:13041" + (f"; rollback siap di {', '.join(rbs)}" if rbs else ""))
    sys.exit(0)

print("GAGAL: log backend terakhir:")
try:
    print(api("GET", f"/containers/{BE}/logs?stdout=1&stderr=1&tail=30", mentah=True)[-3000:].decode("utf-8", "replace"))
except SystemExit as e:
    print(e)
for nama, rb in reversed(diganti):
    if api("GET", f"/containers/{nama}/json", ok=(404,)):  # yang baru (bisa belum di-rename dari -next)
        api("POST", f"/containers/{nama}/stop?t=5", ok=(204, 304))
        api("DELETE", f"/containers/{nama}-gagal-{SHA}?force=1", ok=(204, 404))
        api("POST", f"/containers/{nama}/rename?name={nama}-gagal-{SHA}")
    if rb:
        api("POST", f"/containers/{rb}/rename?name={nama}")
        api("POST", f"/containers/{nama}/start")
print("swap balik selesai" if any(rb for _, rb in diganti) else "deploy pertama gagal; container *-gagal-<sha> ditinggal untuk diperiksa")
sys.exit(1)
PY
