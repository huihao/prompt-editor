#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Detect platform
UNAME_S=$(uname -s)
PLATFORM="unknown"

if [ "$UNAME_S" = "Darwin" ]; then
    PLATFORM="macos"
elif [ "$UNAME_S" = "Linux" ]; then
    PLATFORM="linux"
elif [[ "$OS" == "Windows_NT" ]]; then
    PLATFORM="windows"
fi

echo "=== Building Prompt Editor for $PLATFORM ==="

# Step 1: Build Rust core library
echo ""
echo "--- Building Rust core library ---"
cd core
cargo build --release
echo "Core library built."
cd ..

# Step 2: Build editor (single HTML file)
echo ""
echo "--- Building editor component ---"
cd editor
if [ ! -d node_modules ]; then
    npm install
fi
npx vite build
echo "Editor built: editor/dist/index.html"
cd ..

# Step 3: Build platform-specific app
if [ "$PLATFORM" = "macos" ]; then
    echo ""
    echo "--- Preparing macOS build ---"
    
    # Copy latest Rust library
    echo "Copying Rust library..."
    cp "$SCRIPT_DIR/core/target/release/libprompt_editor_core.a" "$SCRIPT_DIR/macos/Libraries/"
    cp "$SCRIPT_DIR/core/include/prompt_editor.h" "$SCRIPT_DIR/macos/Libraries/"
    
    echo ""
    echo "--- Building macOS app ---"
    cd macos
    swift build -c release --arch arm64
    echo "macOS app built."

    # Create .app bundle
    APP_DIR="$SCRIPT_DIR/build/PromptEditor.app"
    CONTENTS_DIR="$APP_DIR/Contents"
    MACOS_DIR="$CONTENTS_DIR/MacOS"
    RESOURCES_DIR="$CONTENTS_DIR/Resources"

    rm -rf "$APP_DIR"
    mkdir -p "$MACOS_DIR" "$RESOURCES_DIR"

    # Copy binary
    cp .build/release/PromptEditor "$MACOS_DIR/"

    # Copy Info.plist
    cp PromptEditor/Info.plist "$CONTENTS_DIR/"

    # Copy editor HTML
    cp "$SCRIPT_DIR/editor/dist/index.html" "$RESOURCES_DIR/editor.html"

    echo "App bundle: $APP_DIR"
    cd ..
    
    echo ""
    echo "=== Build complete ==="
    echo "Run: open build/PromptEditor.app"

elif [ "$PLATFORM" = "linux" ]; then
    echo ""
    echo "--- Building Linux app ---"
    cd linux
    cargo build --release
    echo "Linux app built."
    cd ..

    # Create build directory and copy files
    BUILD_DIR="$SCRIPT_DIR/build/prompt-editor-linux"
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR/bin" "$BUILD_DIR/share/prompt-editor"

    # Copy binary
    cp linux/target/release/prompt-editor "$BUILD_DIR/bin/"

    # Copy editor HTML
    cp -r editor/dist "$BUILD_DIR/share/prompt-editor/"

    echo "Build directory: $BUILD_DIR"
    echo ""
    echo "=== Build complete ==="
    echo "Run: $BUILD_DIR/bin/prompt-editor"
    echo "Install: make install-linux"

elif [ "$PLATFORM" = "windows" ]; then
    echo ""
    echo "--- Building Windows app ---"
    cd windows
    cargo build --release
    echo "Windows app built."
    cd ..

    # Create build directory
    BUILD_DIR="$SCRIPT_DIR/build/prompt-editor-windows"
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    # Copy binary
    cp windows/target/release/prompt-editor.exe "$BUILD_DIR/"

    echo "Build directory: $BUILD_DIR"
    echo ""
    echo "=== Build complete ==="
    echo "Run: $BUILD_DIR/prompt-editor.exe"

else
    echo ""
    echo "Unsupported platform: $UNAME_S"
    echo "Please build manually for your platform."
    exit 1
fi
