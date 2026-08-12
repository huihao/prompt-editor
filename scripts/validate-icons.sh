#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(dirname "$SCRIPT_DIR")

fail() {
  echo "icon validation failed: $*" >&2
  exit 1
}

dimensions() {
  file=$1
  size=$2
  test -f "$file" || fail "missing $file"
  actual=$(sips -g pixelWidth -g pixelHeight "$file" 2>/dev/null | awk '/pixelWidth:/{w=$2}/pixelHeight:/{h=$2}END{print w "x" h}')
  test "$actual" = "${size}x${size}" || fail "$file is $actual, expected ${size}x${size}"
}

dimensions "$REPO_DIR/assets/branding/prompt-forge-1024.png" 1024

for size in 16 24 32 48 64 128 256 512; do
  dimensions "$REPO_DIR/linux/icons/hicolor/${size}x${size}/apps/prompt-editor.png" "$size"
done

dimensions "$REPO_DIR/windows/icons/32x32.png" 32
dimensions "$REPO_DIR/windows/icons/128x128.png" 128
dimensions "$REPO_DIR/windows/icons/128x128@2x.png" 256
dimensions "$REPO_DIR/windows/icons/icon.png" 256

dimensions "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon.png" 16
dimensions "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon@2x.png" 32
for tray in "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon.png" "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon@2x.png"; do
  sips -g hasAlpha "$tray" 2>/dev/null | grep -q 'hasAlpha: yes' || fail "$tray lacks alpha"
done

dimensions "$REPO_DIR/website/assets/brand/favicon-16.png" 16
dimensions "$REPO_DIR/website/assets/brand/favicon-32.png" 32
dimensions "$REPO_DIR/website/assets/brand/apple-touch-icon.png" 180
dimensions "$REPO_DIR/website/assets/brand/prompt-forge-mark.png" 512

swift "$REPO_DIR/scripts/inspect-image.swift" --corner-alpha \
  "$REPO_DIR/assets/branding/prompt-forge-1024.png" \
  "$REPO_DIR"/linux/icons/hicolor/*/apps/prompt-editor.png \
  "$REPO_DIR/windows/icons/32x32.png" \
  "$REPO_DIR/windows/icons/128x128.png" \
  "$REPO_DIR/windows/icons/128x128@2x.png" \
  "$REPO_DIR/windows/icons/icon.png" \
  "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon.png" \
  "$REPO_DIR/macos/PromptEditor/Resources/StatusBarIcon@2x.png" \
  "$REPO_DIR/website/assets/brand/favicon-16.png" \
  "$REPO_DIR/website/assets/brand/favicon-32.png" \
  "$REPO_DIR/website/assets/brand/apple-touch-icon.png" \
  "$REPO_DIR/website/assets/brand/prompt-forge-mark.png" \
  | awk -F= '$2 != "0,0,0,0" { print; invalid=1 } END { exit invalid }' \
  || fail "generated icon corners are not fully transparent"

test -f "$REPO_DIR/macos/PromptEditor/Resources/PromptEditor.icns" || fail "missing macOS ICNS"
icns_info=$(swift "$REPO_DIR/scripts/inspect-image.swift" "$REPO_DIR/macos/PromptEditor/Resources/PromptEditor.icns")
printf '%s\n' "$icns_info" | grep -q '1024x1024' || fail "ICNS lacks 1024 px representation"

ico_info=$(swift "$REPO_DIR/scripts/inspect-image.swift" "$REPO_DIR/windows/icons/icon.ico")
for size in 16 32 48 128 256; do
  printf '%s\n' "$ico_info" | grep -q "${size}x${size}" || fail "Windows ICO lacks $size px representation"
done

favicon_info=$(swift "$REPO_DIR/scripts/inspect-image.swift" "$REPO_DIR/website/assets/brand/favicon.ico")
for size in 16 32 48; do
  printf '%s\n' "$favicon_info" | grep -q "${size}x${size}" || fail "favicon ICO lacks $size px representation"
done

test -f "$REPO_DIR/assets/branding/prompt-editor-lockup.svg" || fail "missing brand lockup"
test -f "$REPO_DIR/assets/branding/prompt-forge-tray.svg" || fail "missing tray source"

echo "Prompt Forge icon assets are valid."
