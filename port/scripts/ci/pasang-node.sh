#!/usr/bin/env bash
# Node 22 (versi + SHA256 disematkan) untuk job yang memakai image PHP sebagai dasar (e2e GitLab).
set -euo pipefail
VERSI=v22.23.4
SHA256=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce
cd /tmp
curl -fsSLo node.tar.xz "https://nodejs.org/dist/$VERSI/node-$VERSI-linux-x64.tar.xz"
echo "$SHA256  node.tar.xz" | sha256sum -c -
tar -xJf node.tar.xz -C /usr/local --strip-components=1
rm node.tar.xz
node --version
