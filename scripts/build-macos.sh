#!/bin/bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
APP="$ROOT/build/PromptEditor.app"
mkdir -p "$ROOT/build"
TMP=$(mktemp -d "$ROOT/build/.macos-build.XXXXXX")
trap 'rm -rf "$TMP"' EXIT

[[ $(uname -s) == Darwin ]] || { echo "macOS packaging requires macOS." >&2; exit 1; }
for target in aarch64-apple-darwin x86_64-apple-darwin; do
  rustup target list --installed | grep -qx "$target" || { echo "Missing Rust target. Run: rustup target add $target" >&2; exit 1; }
  cargo build --manifest-path "$ROOT/core/Cargo.toml" --release --locked --target "$target"
done
lipo -create "$ROOT/core/target/aarch64-apple-darwin/release/libprompt_editor_core.a" "$ROOT/core/target/x86_64-apple-darwin/release/libprompt_editor_core.a" -output "$ROOT/macos/Libraries/libprompt_editor_core.a"
cp "$ROOT/core/include/prompt_editor.h" "$ROOT/macos/Libraries/"

(cd "$ROOT/editor" && corepack pnpm install --frozen-lockfile && corepack pnpm build)
for arch in arm64 x86_64; do
  scratch="$TMP/swift-$arch"
  swift build --package-path "$ROOT/macos" --scratch-path "$scratch" -c release --arch "$arch"
  bin=$(swift build --package-path "$ROOT/macos" --scratch-path "$scratch" -c release --arch "$arch" --show-bin-path)
  cp "$bin/PromptEditor" "$TMP/PromptEditor-$arch"
done
lipo -create "$TMP/PromptEditor-arm64" "$TMP/PromptEditor-x86_64" -output "$TMP/PromptEditor"

mkdir -p "$TMP/PromptEditor.app/Contents/MacOS" "$TMP/PromptEditor.app/Contents/Resources"
cp "$TMP/PromptEditor" "$TMP/PromptEditor.app/Contents/MacOS/"
cp "$ROOT/macos/PromptEditor/Info.plist" "$TMP/PromptEditor.app/Contents/"
cp -R "$ROOT/macos/PromptEditor/Resources/." "$TMP/PromptEditor.app/Contents/Resources/"
cp "$ROOT/editor/dist/index.html" "$TMP/PromptEditor.app/Contents/Resources/editor.html"
chmod 755 "$TMP/PromptEditor.app/Contents/MacOS/PromptEditor"
plutil -lint "$TMP/PromptEditor.app/Contents/Info.plist"
lipo "$TMP/PromptEditor.app/Contents/MacOS/PromptEditor" -verify_arch arm64 x86_64
rm -rf "$APP"
mv "$TMP/PromptEditor.app" "$APP"
echo "Built Universal 2 app: $APP"
