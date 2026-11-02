#!/usr/bin/env bash
# Grep fitur Oracle di atas 19c yang dilarang (SPEC §6): BOOLEAN, JSON sebagai tipe kolom,
# IF [NOT] EXISTS, SQL_MACRO. Diperiksa di DDL dump (kebenaran skema) dan di migration
# (SQL mentah DB::statement + tipe Blueprint json/jsonb). `IS JSON` (check constraint) boleh.
#   scripts/cek-oracle-terlarang.sh [berkas...]   (bawaan: dump + migration)
set -euo pipefail
cd "$(dirname "$0")/.."

berkas=("$@")
[[ ${#berkas[@]} -eq 0 ]] && berkas=(backend/database/oracle/portal-ddl.sql backend/database/migrations/*.php)

gagal=0
cek() {
  local nama="$1" pola="$2"
  # Baris komentar (// * # --) dilewati: aturan boleh disebut di komentar.
  if grep -nHiP "$pola" "${berkas[@]}" | grep -vP '^[^:]+:\d+:\s*(//|\*|/\*|#|--)'; then
    echo "TERLARANG: $nama" >&2
    gagal=1
  fi
}
cek "BOOLEAN" '\bBOOLEAN\b'
cek "JSON sebagai tipe kolom" '(?<!is )(?<!IS )\bJSON\b(?!_)|->jsonb?\('
cek "IF [NOT] EXISTS" '\bIF\s+(NOT\s+)?EXISTS\b'
cek "SQL_MACRO" '\bSQL_MACRO\b'

if [[ $gagal -eq 0 ]]; then echo "tidak ada fitur Oracle terlarang (${#berkas[@]} berkas)"; fi
exit $gagal
