.PHONY: all core editor macos windows linux clean test test-core test-editor test-macos run

# Detect OS
UNAME_S := $(shell uname -s)

ifeq ($(UNAME_S),Linux)
    TARGET := linux
endif
ifeq ($(UNAME_S),Darwin)
    TARGET := macos
endif
ifeq ($(OS),Windows_NT)
    TARGET := windows
endif

all: core editor $(TARGET)

core:
	cd core && cargo build --release

editor:
	cd editor && npm install && npx vite build

macos:
	cd macos && swift build -c release

windows: core editor
	cd windows && cargo build --release

linux: core editor
	cd linux && cargo build --release

# Cross-platform builds (requires appropriate toolchains)
windows-cross: core editor
	@echo "Building for Windows (cross-compile)..."
	cd windows && cargo build --release --target x86_64-pc-windows-msvc

linux-cross: core editor
	@echo "Building for Linux (cross-compile)..."
	cd linux && cargo build --release --target x86_64-unknown-linux-gnu

test: test-core test-editor test-macos

test-core:
	cd core && cargo test -- --test-threads=1

test-editor:
	cd editor && npx vitest run

test-macos:
	cd macos && swift test

run: all
	./build.sh && open build/PromptEditor.app

clean:
	cd core && cargo clean
	rm -rf editor/dist editor/node_modules
	cd macos && swift package clean
	cd windows && cargo clean 2>/dev/null || true
	cd linux && cargo clean 2>/dev/null || true
	rm -rf build

# Platform-specific install targets
install-macos: macos
	@echo "Installing for macOS..."
	mkdir -p ~/Applications
	cp -r build/PromptEditor.app ~/Applications/

install-linux: linux
	@echo "Installing for Linux..."
	mkdir -p ~/.local/bin
	mkdir -p ~/.local/share/prompt-editor
	cp linux/target/release/prompt-editor ~/.local/bin/
	cp -r editor/dist ~/.local/share/prompt-editor/editor/
	@echo "Installed to ~/.local/bin/prompt-editor"

install-windows: windows
	@echo "Installing for Windows..."
	@echo "Copy windows/target/release/prompt-editor.exe to your desired location"
