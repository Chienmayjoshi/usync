#!/usr/bin/env bash
# Satoshi (Fontshare, ITF Free Font License) may be embedded in the app but not redistributed,
# so the files are not in git. Run this once after cloning to put them in assets/fonts/.
set -euo pipefail
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
curl -sfL -o "$tmp/satoshi.zip" "https://api.fontshare.com/v2/fonts/download/satoshi"
unzip -q -o "$tmp/satoshi.zip" -d "$tmp"
mkdir -p assets/fonts
for w in Regular Medium Bold Black; do cp "$tmp"/Satoshi_Complete/Fonts/OTF/Satoshi-$w.otf assets/fonts/; done
rm -rf "$tmp"
echo "Satoshi installed in assets/fonts/"
