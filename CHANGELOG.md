# Changelog

All notable changes are documented here. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- MIT license and public contribution, security, ownership, issue, and pull-request guidance.
- Reproducible lint, type-check, test, and LCOV coverage commands.
- Universal 2 macOS application builds for Apple Silicon and Intel.
- Versioned DMG and tarball packaging with SHA-256 checksums.
- Optional Developer ID signing and Apple notarization.
- GitHub Actions for pull-request verification and tagged GitHub Releases.
- Installation, CI, and release documentation.

### Changed

- Application lockfiles are tracked and Cargo builds use locked dependency graphs.
- Rust tests isolate user storage and make real clipboard integration explicit.
- TypeScript sources and native-client test doubles satisfy strict type checking.
- macOS is documented as supported; Windows and Linux are explicitly experimental.

### Fixed

- Linux GTK dependency versions now resolve consistently.
- Removed an unused Windows dependency that prevented reproducible resolution.
