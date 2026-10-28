#!/bin/bash
# Skema terpisah untuk tes (phpunit.xml): RefreshDatabase menjalankan migrate:fresh, jadi tes tidak
# boleh memakai skema dev `portal`. Dijalankan tiap start container dan idempoten.
sqlplus -s / as sysdba <<'SQL'
WHENEVER SQLERROR EXIT FAILURE
ALTER SESSION SET CONTAINER = XEPDB1;
DECLARE
  n NUMBER;
BEGIN
  SELECT COUNT(*) INTO n FROM dba_users WHERE username = 'PORTAL_TEST';
  IF n = 0 THEN
    EXECUTE IMMEDIATE 'CREATE USER portal_test IDENTIFIED BY "portal_test" QUOTA UNLIMITED ON USERS';
    EXECUTE IMMEDIATE 'GRANT CONNECT, RESOURCE, CREATE VIEW, CREATE SYNONYM TO portal_test';
  END IF;
END;
/
SQL
