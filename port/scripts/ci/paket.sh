#!/bin/sh
# Job `paket` CI (GitHub & GitLab): bangun image deploy backend dan frontend (deploy/*.Dockerfile)
# tanpa push, supaya paket deploy tidak rusak diam-diam. POSIX sh: image docker:27 di GitLab tidak
# membawa bash. Dibangun satu per satu (hemat memori runner).
set -eu
cd "$(dirname "$0")/../.."
TAG="${PAKET_TAG:-ci}"
docker build -f deploy/backend.Dockerfile -t "dispar-portal-backend:$TAG" .
docker build -f deploy/frontend.Dockerfile -t "dispar-portal-frontend:$TAG" .
# Image backend harus membawa oci8 dan konfigurasi nginx yang valid.
docker run --rm --entrypoint sh "dispar-portal-backend:$TAG" -c 'php -m | grep -qx oci8 && nginx -t -q'
