#!/usr/bin/env bash
# Dump skema Oracle portal ke SQL (SPEC §6): `php artisan schema:dump` tidak mendukung Oracle.
#
#   backend/database/oracle/portal-ddl.sql   tabel, sequence, index, trigger (DBMS_METADATA.GET_DDL)
#   backend/database/oracle/portal-seed.sql  akun layanan, TANPA token
#
# Jalankan dari port/, setelah `php artisan migrate:fresh --seed` di Oracle compose.dev.yaml:
#   scripts/oracle-dump.sh
# Uji terap ke skema kosong (dipakai CI):
#   scripts/oracle-dump.sh --cek
# Di luar compose (CI): ORACLE_SQLPLUS = perintah sqlplus (mis. "sqlplus -s" atau
# "docker exec -i <id> sqlplus -s"), ORACLE_DSN = alamat layanan (mis. //oracle:1521/XEPDB1).
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE=(docker compose -f compose.dev.yaml)
USER_APP="${DB_USERNAME:-portal}"
PASS_APP="${DB_PASSWORD:-portal_dev}"
PASS_SYS="${ORACLE_PASSWORD:-portal_dev}"
KELUAR=backend/database/oracle

DSN="${ORACLE_DSN:-XEPDB1}"
if [[ -n "${ORACLE_SQLPLUS:-}" ]]; then
  read -r -a SQLPLUS_CMD <<<"$ORACLE_SQLPLUS"
  # `command`: ORACLE_SQLPLUS bisa diawali "sqlplus" — tanpa ini fungsi memanggil dirinya sendiri.
  sqlplus() { command "${SQLPLUS_CMD[@]}" "$@"; }
else
  sqlplus() { "${COMPOSE[@]}" exec -T oracle sqlplus -s "$@"; }
fi

if [[ "${1:-}" == "--cek" ]]; then
  # Skema kosong sementara, terapkan dump, lalu buang.
  sqlplus "system/${PASS_SYS}@${DSN}" <<SQL >/dev/null
whenever sqlerror exit failure
begin execute immediate 'drop user portal_cek cascade'; exception when others then null; end;
/
create user portal_cek identified by "cek_${PASS_APP}" quota unlimited on users;
grant create session, create table, create sequence, create trigger to portal_cek;
exit
SQL
  { echo "whenever sqlerror exit failure"; cat "$KELUAR/portal-ddl.sql" "$KELUAR/portal-seed.sql"; echo "exit"; } \
    | sqlplus "portal_cek/cek_${PASS_APP}@${DSN}" >/dev/null
  jumlah=$(sqlplus "portal_cek/cek_${PASS_APP}@${DSN}" <<'SQL' | tr -d '[:space:]'
set heading off feedback off
select count(*) from user_tables;
exit
SQL
)
  sqlplus "system/${PASS_SYS}@${DSN}" <<'SQL' >/dev/null
drop user portal_cek cascade;
exit
SQL
  echo "dump diterapkan ke skema kosong: ${jumlah} tabel"
  exit 0
fi

mkdir -p "$KELUAR"

sqlplus "${USER_APP}/${PASS_APP}@${DSN}" <<'SQL' | sed -e 's/[[:space:]]*$//' -e "s/\"$(echo "${USER_APP}" | tr a-z A-Z)\"\.//g" > "$KELUAR/portal-ddl.sql"
set long 1000000 longchunksize 1000000 pagesize 0 linesize 32767 trimspool on heading off feedback off verify off
begin
  dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'SEGMENT_ATTRIBUTES', false);
  dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'STORAGE', false);
  dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'EMIT_SCHEMA', false);
  dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'SQLTERMINATOR', true);
  dbms_metadata.set_transform_param(dbms_metadata.session_transform, 'PRETTY', true);
end;
/
select '-- Dump skema portal (scripts/oracle-dump.sh). Jangan diedit tangan.' from dual;
-- Urutan terap: sequence, tabel (+ constraint), index non-constraint, trigger.
select dbms_metadata.get_ddl('SEQUENCE', sequence_name) from user_sequences order by sequence_name;
select dbms_metadata.get_ddl('TABLE', table_name) from user_tables order by table_name;
select dbms_metadata.get_ddl('INDEX', i.index_name)
  from user_indexes i
 where i.index_type <> 'LOB'
   and not exists (select 1 from user_constraints c where c.index_name = i.index_name)
 order by i.index_name;
select dbms_metadata.get_ddl('TRIGGER', trigger_name) from user_triggers order by trigger_name;
exit
SQL

# Nilai START WITH sequence mengikuti data saat dump; kembalikan ke 1 supaya dump bersih.
sed -i -E 's/START WITH [0-9]+/START WITH 1/' "$KELUAR/portal-ddl.sql"

sqlplus "${USER_APP}/${PASS_APP}@${DSN}" <<'SQL' | sed -e 's/[[:space:]]*$//' > "$KELUAR/portal-seed.sql"
set pagesize 0 linesize 400 heading off feedback off verify off
select '-- Seed akun layanan portal (tanpa token; token dibuat dengan php artisan portal:token).' from dual;
select 'insert into users (name, created_at, updated_at) values (''' || name || ''', systimestamp, systimestamp);'
  from users order by id;
select 'commit;' from dual;
exit
SQL

echo "ditulis: $KELUAR/portal-ddl.sql ($(grep -c ';$' "$KELUAR/portal-ddl.sql") pernyataan), $KELUAR/portal-seed.sql"
