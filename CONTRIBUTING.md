# Contributing to Prompt Editor

Thank you for improving Prompt Editor. macOS is the supported platform; Windows and Linux are experimental. Describe the platform and architecture affected by every platform-specific change.

## Before Opening an Issue

Search existing issues and the [feature support matrix](docs/feature-support-matrix.md). Do not post API keys, prompt history, terminal output, signing certificates, or other sensitive data. Use [SECURITY.md](SECURITY.md) for security reports.

## Development Setup

The full macOS build requires macOS 12 or newer, Xcode Command Line Tools, Rust 1.85 or newer, Node.js 24 or newer with Corepack, and GNU Make. Universal builds also require the `aarch64-apple-darwin` and `x86_64-apple-darwin` Rust targets.

```bash
corepack pnpm --dir editor install --frozen-lockfile
make verify
```

Focused commands:

```bash
make test-core
make test-editor
make test-macos
make typecheck
make lint
```

## Making Changes

1. Create a focused branch from the current default branch.
2. Add or update tests before changing behavior.
3. Keep platform-independent behavior in `core/` or `editor/`; use the native-client boundary for host-specific behavior.
4. Preserve user data formats unless the change includes a tested migration.
5. Update public documentation and `CHANGELOG.md` for user-visible changes.
6. Run `make verify` before opening a pull request.

Do not commit build output, local configuration, credentials, signing material, notarization profiles, or application data.

## Commits and Pull Requests

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: add prompt export
fix: isolate storage tests
docs: explain unsigned macOS builds
```

Keep commits independently reviewable. Pull requests should explain the problem, approach, verification commands, user impact, and platform limitations.

## Code Style

- Rust: `cargo fmt` and Clippy with warnings denied.
- TypeScript: strict types; avoid new `any` values when an interface can express the contract.
- Swift: existing AppKit and Swift API naming conventions.
- Shell: `set -euo pipefail`, quoted paths, and validated destructive targets.
- Documentation and public identifiers: English first; localized UI may include Chinese.

Comments should explain constraints and intent, especially around FFI safety, process execution, storage migration, and native bridge behavior.

## Tests

Unit tests must be deterministic and must not use normal user data. Tests requiring a real clipboard, GUI session, Apple credential, or external service must be opt-in and labeled. Never use production API keys in tests.

Windows and Linux changes require evidence from the corresponding platform before support status can be upgraded.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
