.PHONY: all core editor macos macos-core-library package-macos windows linux clean test test-core test-editor test-macos test-clipboard typecheck lint coverage coverage-core coverage-editor verify run

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
	cd core && cargo build --release --locked

macos-core-library: core
	cp core/target/release/libprompt_editor_core.a macos/Libraries/
	cp core/include/prompt_editor.h macos/Libraries/

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

macos:
	./scripts/build-macos.sh

package-macos:
	@test -n "$(VERSION)" || { echo "usage: make package-macos VERSION=0.1.0" >&2; exit 2; }
	./scripts/package-macos.sh "$(VERSION)"

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

test-macos: macos-core-library
	cd macos && swift test

test-clipboard:
	cd core && cargo test clipboard -- --ignored --test-threads=1

typecheck:
	cd editor && $(PNPM) typecheck

lint:
	cd core && cargo fmt -- --check
	cd core && cargo clippy --all-targets --all-features -- -D warnings
	$(MAKE) typecheck
	@if [ "$(UNAME_S)" = "Darwin" ]; then cd macos && swift package dump-package >/dev/null; fi

coverage: coverage-editor coverage-core

coverage-editor:
	cd editor && $(PNPM) coverage

coverage-core:
	@command -v cargo-llvm-cov >/dev/null 2>&1 || { \
		echo "cargo llvm-cov is required for Rust coverage." >&2; \
		echo "Install it with: cargo install cargo-llvm-cov --locked" >&2; \
		exit 1; \
	}
	mkdir -p core/coverage
	cd core && cargo llvm-cov --all-features --workspace --lcov --output-path coverage/lcov.info

verify: lint test editor

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
