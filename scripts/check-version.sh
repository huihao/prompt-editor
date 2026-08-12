#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=${1#v}
[ -n "$VERSION" ] || { echo "usage: $0 <version>" >&2; exit 2; }

editor=$(node -p "require('$ROOT/editor/package.json').version")
core=$(cargo metadata --manifest-path "$ROOT/core/Cargo.toml" --format-version 1 --locked --no-deps | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).packages[0].version))')
plist=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$ROOT/macos/PromptEditor/Info.plist")

for pair in "editor:$editor" "core:$core" "macOS:$plist"; do
  actual=${pair#*:}
  [ "$actual" = "$VERSION" ] || { echo "version mismatch: $pair (expected $VERSION)" >&2; exit 1; }
done
echo "All project versions match $VERSION."
