#!/usr/bin/env bash
# Preflight Portainer — jalankan SEBELUM minta Claude men-deploy.
# Memeriksa berurutan: env → jaringan → auth → environment → stack,
# dan berhenti di kegagalan PERTAMA dengan cara memperbaikinya.
#
#   bash scripts/preflight-portainer.sh
#
# Keluar 0 = aman untuk deploy.

set -uo pipefail

URL="${PORTAINER_URL:-https://192.168.18.187:9443}"
KEY="${PORTAINER_API_KEY:-}"
ENDPOINT_ID="${PORTAINER_ENDPOINT_ID:-3}"
STACK_ID="${PORTAINER_STACK_ID:-6}"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }
info() { printf '    %s\n' "$1"; }

echo
echo "Preflight Portainer — $URL"
echo "────────────────────────────────────────────────────────"

# 1 — env
if [ -z "$KEY" ]; then
  bad "PORTAINER_API_KEY belum di-set"
  info ""
  info "Inilah penyebab paling sering 'Claude tidak bisa deploy'."
  info "Berkas .mcp.json memakai \${PORTAINER_API_KEY}; kalau env kosong,"
  info "MCP jalan TANPA kredensial dan semua panggilan ditolak 401."
  info ""
  info "Perbaiki — set DULU, baru jalankan Claude Code:"
  info "  export PORTAINER_URL=$URL"
  info "  export PORTAINER_API_KEY=ptr_xxx      # token milikmu sendiri"
  info "  export PORTAINER_TLS_VERIFY=false"
  info ""
  info "Token dibuat di Portainer → ikon user → My account → Access tokens."
  info "Supaya awet, taruh ketiganya di ~/.bashrc atau ~/.zshrc."
  info "JANGAN menaruhnya di berkas repo — repo ini publik."
  echo
  exit 1
fi
ok "PORTAINER_API_KEY ter-set (${#KEY} karakter)"

# 2 — jaringan
STATUS_JSON=$(curl -sk --max-time 10 "$URL/api/status" 2>/dev/null)
if [ -z "$STATUS_JSON" ]; then
  bad "Server Portainer tidak terjangkau di $URL"
  info "Server ada di LAN 192.168.18.0/24 — dari luar kantor butuh VPN."
  info "Cek: ping 192.168.18.187"
  echo
  exit 1
fi
ok "Server terjangkau — $(echo "$STATUS_JSON" | grep -o '"Version":"[^"]*"' | cut -d'"' -f4)"

# 3 — auth
AUTH_JSON=$(curl -sk --max-time 10 -H "X-API-Key: $KEY" "$URL/api/stacks" 2>/dev/null)
case "$AUTH_JSON" in
  *"Invalid JWT token"*|*"Invalid API key"*|*"Unauthorized"*)
    bad "Kredensial DITOLAK server (token tidak sah / sudah dicabut)"
    info ""
    info "Servernya sehat, tapi token ini tidak diterima. Biasanya karena"
    info "token sudah dicabut, dihapus, atau salah salin."
    info ""
    info "Perbaiki: buat token BARU di Portainer → My account → Access tokens,"
    info "lalu export ulang PORTAINER_API_KEY dan JALANKAN ULANG Claude Code"
    info "(MCP membaca env hanya saat start — reload tidak cukup)."
    echo
    exit 1
    ;;
  "")
    bad "Tidak ada balasan saat uji auth"
    echo; exit 1 ;;
esac
ok "Auth diterima"

# 4 — environment
if ! curl -sk --max-time 10 -H "X-API-Key: $KEY" "$URL/api/endpoints/$ENDPOINT_ID" 2>/dev/null | grep -q '"Id"'; then
  bad "Environment id=$ENDPOINT_ID tidak terlihat oleh token ini"
  info "Semua perintah deploy memakai endpointId=$ENDPOINT_ID."
  info "Kalau tokenmu dibatasi, minta admin memberi akses environment itu."
  echo
  exit 1
fi
ok "Environment id=$ENDPOINT_ID terlihat"

# 5 — stack app
STACK_JSON=$(curl -sk --max-time 10 -H "X-API-Key: $KEY" "$URL/api/stacks/$STACK_ID" 2>/dev/null)
if ! echo "$STACK_JSON" | grep -q '"Id"'; then
  bad "Stack id=$STACK_ID (dispar-lakehouse) tidak terbaca"
  info "Di situlah container dispar-v2 hidup. Cek daftar stack di UI."
  echo
  exit 1
fi
STACK_NAME=$(echo "$STACK_JSON" | grep -o '"Name":"[^"]*"' | head -1 | cut -d'"' -f4)
STACK_REF=$(echo "$STACK_JSON"  | grep -o '"ReferenceName":"[^"]*"' | head -1 | cut -d'"' -f4)
STACK_REPO=$(echo "$STACK_JSON" | grep -o '"URL":"[^"]*"' | head -1 | cut -d'"' -f4)
ENV_COUNT=$(echo "$STACK_JSON" | grep -o '"name":"[^"]*"' | wc -l | tr -d ' ')
ok "Stack $STACK_ID = $STACK_NAME ($STACK_REF, $ENV_COUNT env var)"

echo "────────────────────────────────────────────────────────"
echo "  SIAP DEPLOY."
echo
echo "  Stack ini menarik dari:"
echo "    $STACK_REPO"
case "$STACK_REPO" in
  *jakarta-restaurant-data*)
    echo
    printf '  \033[33m!\033[0m Itu repo LAMA. Dorong ke DUA tempat atau kodemu tidak akan tayang:\n'
    echo "      git push origin main && git push lama main"
    echo "    Lupa yang kedua → redeploy membangun kode lama dan MELAPOR SUKSES."
    ;;
esac
echo
echo "  Lanjut: minta Claude jalankan /deploy-v2, atau ikuti docs/DEPLOY-RUNBOOK.md"
echo
exit 0
