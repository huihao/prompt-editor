#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(dirname "$SCRIPT_DIR")
SOURCE="$REPO_DIR/assets/branding/prompt-forge.svg"
TRAY_SOURCE="$REPO_DIR/assets/branding/prompt-forge-tray.svg"
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/prompt-forge.XXXXXX")
trap 'rm -rf "$TMP_DIR"' EXIT HUP INT TERM

MASTER="$REPO_DIR/assets/branding/prompt-forge-1024.png"
mkdir -p "$(dirname "$MASTER")"
sips -s format png -z 1024 1024 "$SOURCE" --out "$MASTER" >/dev/null

resize() {
  size=$1
  output=$2
  mkdir -p "$(dirname "$output")"
  sips -z "$size" "$size" "$MASTER" --out "$output" >/dev/null
}

for size in 16 24 32 48 64 128 256 512; do
  resize "$size" "$REPO_DIR/linux/icons/hicolor/${size}x${size}/apps/prompt-editor.png"
done

resize 32 "$REPO_DIR/windows/icons/32x32.png"
resize 128 "$REPO_DIR/windows/icons/128x128.png"
resize 256 "$REPO_DIR/windows/icons/128x128@2x.png"
resize 256 "$REPO_DIR/windows/icons/icon.png"

ICONSET="$TMP_DIR/PromptEditor.iconset"
mkdir -p "$ICONSET"
for entry in "16 icon_16x16.png" "32 icon_16x16@2x.png" "32 icon_32x32.png" "64 icon_32x32@2x.png" "128 icon_128x128.png" "256 icon_128x128@2x.png" "256 icon_256x256.png" "512 icon_256x256@2x.png" "512 icon_512x512.png" "1024 icon_512x512@2x.png"; do
  set -- $entry
  resize "$1" "$ICONSET/$2"
done
mkdir -p "$REPO_DIR/macos/PromptEditor/Resources"
iconutil --convert icns --output "$REPO_DIR/macos/PromptEditor/Resources/PromptEditor.icns" "$ICONSET"

mkdir -p "$TMP_DIR/ico" "$REPO_DIR/windows/icons"
for size in 16 32 48 128 256; do
  resize "$size" "$TMP_DIR/ico/$size.png"
done
swift "$REPO_DIR/scripts/make-ico.swift" "$REPO_DIR/windows/icons/icon.ico" \
  "$TMP_DIR/ico/16.png" "$TMP_DIR/ico/32.png" "$TMP_DIR/ico/48.png" \
  "$TMP_DIR/ico/128.png" "$TMP_DIR/ico/256.png"

sips -s format png -z 16 16 "$TRAY_SOURCE" --out "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon.png" >/dev/null
sips -s format png -z 32 32 "$TRAY_SOURCE" --out "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon@2x.png" >/dev/null

mkdir -p "$REPO_DIR/website/assets/brand"
resize 16 "$REPO_DIR/website/assets/brand/favicon-16.png"
resize 32 "$REPO_DIR/website/assets/brand/favicon-32.png"
resize 180 "$REPO_DIR/website/assets/brand/apple-touch-icon.png"
resize 512 "$REPO_DIR/website/assets/brand/prompt-forge-mark.png"
swift "$REPO_DIR/scripts/make-ico.swift" "$REPO_DIR/website/assets/brand/favicon.ico" \
  "$TMP_DIR/ico/16.png" "$TMP_DIR/ico/32.png" "$TMP_DIR/ico/48.png"
cp "$REPO_DIR/assets/branding/prompt-editor-lockup.svg" "$REPO_DIR/website/assets/brand/prompt-editor-lockup.svg"

echo "Generated Prompt Forge icon assets."
