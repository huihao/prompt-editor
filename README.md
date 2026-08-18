# Prompt Editor

Prompt Editor is a native macOS prompt workspace for coding agents and terminal tools. It combines a CodeMirror Markdown editor, reusable snippets and templates, prompt history, agent-history scanning, and terminal-aware send actions.

macOS 12 or newer is the supported platform. Windows and Linux ports remain experimental: their source is retained, but they are not part of the signed release pipeline.

## Features

- Markdown editing with syntax highlighting and image paste support
- Prompt history, favorites, templates, snippets, and AI-assisted editing
- Prompt-memory import from supported coding-agent histories
- Global macOS shortcut and terminal-aware paste/send behavior
- Rust core shared through a stable C FFI boundary
- Universal 2 macOS builds for Apple Silicon and Intel

## Install

Download the `.dmg` from the GitHub Release, open it, and drag **Prompt Editor** to **Applications**. The `.tar.gz` is provided for automation and environments where mounting a disk image is inconvenient. Verify the adjacent checksum before installation:

```bash
shasum -a 256 -c PromptEditor-0.1.0-macos-universal.dmg.sha256
```

The app asks for Accessibility permission only when terminal paste automation needs it. See [Installation](docs/INSTALLATION.md) for source builds, uninstall steps, Gatekeeper troubleshooting, and permission details.

## Use

Launch Prompt Editor from Applications. Use `Command+Shift+P` to show or hide the window, and `Escape` to hide it. Copy the prompt to the clipboard or paste it back to the last input position, then paste it into your CLI tool. Pasting into another app may require Accessibility permission under **System Settings > Privacy & Security**.

## Develop

Requirements: Rust 1.85+, Node.js 20+ with Corepack, and GNU Make. macOS builds also require Xcode Command Line Tools and both Rust targets:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
corepack pnpm --dir editor install --frozen-lockfile
make verify
```

Common commands:

```bash
make test                    # Rust, editor, and macOS tests on macOS
make lint                    # rustfmt, Clippy, TypeScript, Swift manifest
make coverage                # editor and Rust LCOV reports
make macos                   # Universal 2 app bundle
make package-macos VERSION=0.1.0
```

Rust coverage requires `cargo-llvm-cov` and `llvm-tools-preview`; `make coverage` prints the installation command when the executable is missing. Real clipboard tests are opt-in with `make test-clipboard`.

## Architecture

```text
core/       Rust storage, clipboard, Markdown, scanning, templates, and C FFI
editor/     TypeScript/CodeMirror editor bundled as one embedded HTML file
macos/      SwiftPM/AppKit shell, WKWebView bridge, terminal integrations
windows/    Experimental Tauri shell
linux/      Experimental GTK4/WebKitGTK shell
scripts/    Version, Universal 2 build, signing, notarization, packaging
```

The detailed support matrix is in [docs/feature-support-matrix.md](docs/feature-support-matrix.md). Repository risks and remediation status are tracked in [CODE_REVIEW.md](CODE_REVIEW.md) and [OPENSOURCE_PLAN.md](OPENSOURCE_PLAN.md).

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. Use Conventional Commits, include focused tests, and run `make verify`. Report vulnerabilities according to [SECURITY.md](SECURITY.md), not in public issues.

## License

Prompt Editor is available under the [MIT License](LICENSE). Copyright (c) 2026 Kimi Wu.
