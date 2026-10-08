#!/usr/bin/env bash
# lakehouse/scripts/build-dagster-image.sh <tag>
#
# Membangun image Dagster dari git archive HEAD:
# Hanya menyertakan lakehouse/ + berkas yang terdaftar di lakehouse/sources.toml.
# Tidak pernah menyertakan berkas untracked, ignored, atau rahasia (.env).

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Penggunaan: $0 <tag>" >&2
  exit 1
fi

TAG="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

if [ ! -f "lakehouse/sources.toml" ]; then
  echo "Error: lakehouse/sources.toml tidak ditemukan di $REPO_ROOT" >&2
  exit 1
fi

# Ambil semua `path` dari [[sumber]] di lakehouse/sources.toml ke dalam array bash
mapfile -t REGISTERED_PATHS < <(python3 -c '
import tomllib
with open("lakehouse/sources.toml", "rb") as f:
    data = tomllib.load(f)
paths = [s["path"] for s in data.get("sumber", []) if s.get("path")]
print("\n".join(paths))
')

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

echo "Menyusun build context dari git archive HEAD..."
git archive HEAD lakehouse "${REGISTERED_PATHS[@]}" | tar -x -C "$TMP_DIR"

echo "Membangun image Dagster: $TAG..."
docker build -t "$TAG" -f "$TMP_DIR/lakehouse/orchestrate/Dockerfile" "$TMP_DIR"

if [[ "$TAG" != *:* ]]; then
  docker tag "$TAG" "dispar-lake-dagster:$TAG"
fi

echo "Selesai: image $TAG berhasil dibangun."
