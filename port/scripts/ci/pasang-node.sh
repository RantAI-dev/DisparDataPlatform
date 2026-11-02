#!/usr/bin/env bash
# Node 20 (versi + SHA256 disematkan) untuk job yang memakai image PHP sebagai dasar (e2e GitLab).
set -euo pipefail
VERSI=v20.20.2
SHA256=df770b2a6f130ed8627c9782c988fda9669fa23898329a61a871e32f965e007d
cd /tmp
curl -fsSLo node.tar.xz "https://nodejs.org/dist/$VERSI/node-$VERSI-linux-x64.tar.xz"
echo "$SHA256  node.tar.xz" | sha256sum -c -
tar -xJf node.tar.xz -C /usr/local --strip-components=1
rm node.tar.xz
node --version
