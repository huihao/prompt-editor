#!/bin/bash
set -euo pipefail
export LC_ALL=C

ROOT=$(cd "$(dirname "$0")/.." && pwd)
VERSION=${1:-}
[[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]] || { echo "usage: $0 <semver>" >&2; exit 2; }
"$ROOT/scripts/check-version.sh" "$VERSION"
[[ ${SKIP_BUILD:-0} == 1 ]] || "$ROOT/scripts/build-macos.sh"
APP="$ROOT/build/PromptEditor.app"
OUT="$ROOT/build/release"
mkdir -p "$OUT"

if [[ -n ${MACOS_SIGNING_IDENTITY:-} ]]; then
  codesign --force --options runtime --timestamp --sign "$MACOS_SIGNING_IDENTITY" "$APP"
  codesign --verify --deep --strict --verbose=2 "$APP"
elif [[ ${MACOS_REQUIRE_SIGNING:-0} == 1 ]]; then
  echo "MACOS_SIGNING_IDENTITY is required." >&2; exit 1
fi

tar -C "$ROOT/build" -czf "$OUT/PromptEditor-$VERSION-macos-universal.tar.gz" PromptEditor.app
STAGE=$(mktemp -d "$ROOT/build/.dmg.XXXXXX")
trap 'rm -rf "$STAGE"' EXIT
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
hdiutil create -quiet -volname "Prompt Editor" -srcfolder "$STAGE" -ov -format UDZO "$OUT/PromptEditor-$VERSION-macos-universal.dmg"

if [[ -n ${APPLE_NOTARY_PROFILE:-} ]]; then
  xcrun notarytool submit "$OUT/PromptEditor-$VERSION-macos-universal.dmg" --keychain-profile "$APPLE_NOTARY_PROFILE" --wait
  xcrun stapler staple "$OUT/PromptEditor-$VERSION-macos-universal.dmg"
fi
for artifact in "$OUT"/PromptEditor-"$VERSION"-macos-universal.{tar.gz,dmg}; do
  (cd "$OUT" && shasum -a 256 "$(basename "$artifact")" > "$(basename "$artifact").sha256")
done
echo "Release artifacts: $OUT"
