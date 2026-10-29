#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64) arch=arm64 ;;
  *) echo 'Unsupported CPU architecture.' >&2; exit 1 ;;
esac
apt-get update
apt-get install -y ca-certificates curl xz-utils
staging=$(mktemp -d /tmp/youyu-node.XXXXXXXX)
trap 'rm -f -- "$staging/SHASUMS256.txt" "$staging/node.tar.xz"; rmdir -- "$staging"' EXIT
base=https://nodejs.org/dist/latest-v24.x
curl --fail --location --retry 3 --connect-timeout 15 --max-time 300 "$base/SHASUMS256.txt" -o "$staging/SHASUMS256.txt"
line=$(awk -v suffix="linux-$arch.tar.xz" '$2 ~ ("^node-v24\\.[0-9]+\\.[0-9]+-" suffix "$") { print; exit }' "$staging/SHASUMS256.txt")
[[ -n $line ]] || { echo 'Cannot find an official Node.js 24 download.' >&2; exit 1; }
checksum=${line%% *}
filename=${line##* }
[[ $filename =~ ^node-v24\.[0-9]+\.[0-9]+-linux-(x64|arm64)\.tar\.xz$ ]] || exit 1
curl --fail --location --retry 3 --connect-timeout 15 --max-time 600 "$base/$filename" -o "$staging/node.tar.xz"
printf '%s  %s\n' "$checksum" "$staging/node.tar.xz" | sha256sum --check --status
install -d /usr/local/lib/youyu-node
tar -xJf "$staging/node.tar.xz" -C /usr/local/lib/youyu-node
prefix="/usr/local/lib/youyu-node/${filename%.tar.xz}"
for executable in node npm npx; do ln -sfn "$prefix/bin/$executable" "/usr/local/bin/$executable"; done
/usr/local/bin/node --version
/usr/local/bin/npm --version
