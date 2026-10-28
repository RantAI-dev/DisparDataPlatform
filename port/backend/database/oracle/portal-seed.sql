-- Seed akun layanan portal (tanpa token; token dibuat dengan php artisan portal:token).
insert into users (name, created_at, updated_at) values ('frontend', systimestamp, systimestamp);
insert into users (name, created_at, updated_at) values ('admin', systimestamp, systimestamp);
commit;
