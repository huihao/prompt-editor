.PHONY: all core editor macos windows linux clean test test-core test-editor test-macos run

# Detect OS
UNAME_S := $(shell uname -s)
PNPM ?= corepack pnpm

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

core-universal:
	@echo "Building universal binary for macOS..."
	cd core && cargo build --release --target aarch64-apple-darwin 2>/dev/null || cargo build --release
	cd core && cargo build --release --target x86_64-apple-darwin 2>/dev/null || true
	@if [ -f core/target/aarch64-apple-darwin/release/libprompt_editor_core.a ] && [ -f core/target/x86_64-apple-darwin/release/libprompt_editor_core.a ]; then \
		lipo -create -output core/target/release/libprompt_editor_core.a \
			core/target/aarch64-apple-darwin/release/libprompt_editor_core.a \
			core/target/x86_64-apple-darwin/release/libprompt_editor_core.a; \
		echo "Created universal binary."; \
	else \
		echo "Using default architecture build."; \
	fi

editor:
	cd editor && $(PNPM) install --frozen-lockfile && $(PNPM) build

macos: core-universal editor
	cp core/target/release/libprompt_editor_core.a macos/Libraries/
	cp core/include/prompt_editor.h macos/Libraries/
	cd macos && arch -arm64 swift build -c release
	rm -rf build/PromptEditor.app
	mkdir -p build/PromptEditor.app/Contents/MacOS build/PromptEditor.app/Contents/Resources
	cp macos/.build/release/PromptEditor build/PromptEditor.app/Contents/MacOS/
	cp macos/PromptEditor/Info.plist build/PromptEditor.app/Contents/
	cp editor/dist/index.html build/PromptEditor.app/Contents/Resources/editor.html

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
	cd editor && $(PNPM) test

test-macos:
	cd macos && swift test

run: all
	./build.sh && open -n build/PromptEditor.app

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
