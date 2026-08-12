# Open-Source and Release Readiness Design

## Objective

Prepare Prompt Editor for public source distribution, reproducible local development, reliable testing, and continuous macOS releases without breaking current product behavior. macOS is the supported release platform for this milestone. Existing Windows and Linux implementations remain available as experimental ports.

## Current Baseline

Prompt Editor combines a Rust core library, a TypeScript/CodeMirror web editor, and native platform shells. The macOS shell uses Swift Package Manager and AppKit. The Windows and Linux shells have separate Rust manifests and platform dependencies.

The repository already provides a `Makefile`, an editor lockfile, Rust and Swift unit tests, and a macOS application bundle build. It does not yet include a public license, community health files, release workflows, an installable disk image, checksums, code coverage, or documented signing and notarization.

Baseline verification on 2026-08-12 found:

- Editor tests pass: 23 files and 174 tests.
- Rust tests run 74 tests; 69 pass and 5 fail because clipboard tests require a usable system clipboard and one FFI storage test shares the default user data location.
- Strict TypeScript checking reports existing source and test type errors and is not part of `make test`.
- Swift testing cannot complete in the current restricted execution sandbox because SwiftPM invokes its own sandbox. This is an environment limitation to verify again in normal local and GitHub-hosted macOS environments.

## Support Policy

macOS 12 and newer is the supported platform. Release builds target both `arm64` and `x86_64` and combine them into a Universal 2 application when both toolchains are available. CI is the authoritative clean macOS verification environment.

Windows and Linux remain source-visible and backward compatible, but are labeled experimental. Their builds may be checked where practical, but this milestone does not claim verified GUI releases for platforms that cannot be exercised locally. Known limitations, including incomplete Wayland shortcut support, are documented rather than hidden.

## License and Governance

The project will use the MIT License with `Copyright (c) 2026 Kimi Wu`. The direct JavaScript and Rust dependency set is dominated by MIT, Apache-2.0, BSD-style, Zlib, BSL-1.0, MPL-2.0, and similarly permissive licenses. These are compatible with distributing the project under MIT when their attribution and source-level obligations are preserved. A generated dependency inventory will document notable exceptions and unknown metadata.

The repository will add or complete:

- `README.md`, primarily in English, with product scope, support status, installation, usage, development, testing, contribution, security, and license sections.
- `CONTRIBUTING.md`, `CHANGELOG.md`, and `SECURITY.md`.
- `.github/CODEOWNERS`, issue forms, pull request template, and workflow files.
- A corrected `.gitignore` that retains reproducibility lockfiles and does not accidentally ignore source test files by broad suffix.

No repository URL, security contact, Apple identity, Homebrew tap, or signing secret will be invented. Documentation and workflows will use explicit configuration placeholders expressed as environment variable names or repository settings, with safe behavior when optional credentials are absent.

## Audit Deliverables

`CODE_REVIEW.md` will be a repository-wide assessment containing:

- A tracked-source directory tree and responsibility map.
- File and module quality findings grouped by subsystem, with large or duplicated files called out individually and small cohesive files grouped in complete tables.
- Direct dependency constraints, resolved versions, license families, compatibility conclusions, and transitive-license risk notes.
- Complete scans of tracked source for hard-coded paths, credential-like values, and actionable `TODO`, `FIXME`, `HACK`, and `XXX` markers, with examples in tests and fixtures classified separately.
- macOS, Linux, and Windows portability findings.
- Documentation, linting, type-annotation, test, and packaging gaps.
- The MIT recommendation and its compatibility rationale.

`OPENSOURCE_PLAN.md` will convert every actionable audit finding into P0, P1, or P2 work. Every item records its impact, solution, effort estimate, validation command, and final status. Items that cannot be completed without external credentials or non-macOS runners remain explicitly pending with a documented owner action.

## Test and Quality Design

The root `Makefile` is the stable developer interface:

- `make lint` performs offline formatting and static checks available from the pinned toolchains.
- `make test` runs deterministic Rust, editor, and macOS test suites.
- `make coverage` generates Rust and editor coverage where coverage tools are installed and reports an actionable setup message otherwise.
- `make verify` runs lint, tests, and release builds appropriate to the host.

Tests that exercise the real system clipboard will be separated from deterministic unit tests or will skip with an explicit reason when the clipboard is unavailable. Storage tests will use temporary directories or dependency injection so they never write to or depend on a developer's normal data directory.

Type checking will receive a dedicated command. Existing errors that can be corrected without behavior changes are fixed. Generated/raw module declarations and test mocks will be typed explicitly. The unused backup UI source will be excluded from the production TypeScript compilation or removed only if Git history proves it is not imported; removal must not affect runtime output.

Editor coverage uses Vitest's supported coverage provider and produces text and machine-readable reports. Rust coverage uses `cargo llvm-cov` when present. SwiftPM has no built-in portable combined coverage exporter for this setup, so Swift tests remain a required suite while Xcode/LLVM coverage collection is documented as an optional extension.

## macOS Packaging Design

The packaging implementation is split into deterministic scripts:

1. Build the editor with the committed pnpm lockfile.
2. Build the Rust core for `aarch64-apple-darwin` and `x86_64-apple-darwin`.
3. Combine the static libraries with `lipo` and build the Swift executable for both architectures.
4. Assemble `PromptEditor.app` with its executable, `Info.plist`, and embedded editor HTML.
5. Validate architectures, bundle structure, minimum macOS version, and code-signing state.
6. Optionally sign nested code and the application when a Developer ID identity is supplied.
7. Create a compressed `.tar.gz` and a read-only `.dmg` using native macOS tools.
8. Optionally submit the signed disk image to Apple's notary service and staple the result when notarization credentials are supplied.
9. Produce SHA-256 checksum files for every distributable.

Unsigned local packages are valid development artifacts and are clearly named or documented as unsigned. Release CI fails if signing is explicitly required but credentials are incomplete. Secrets are accepted only through environment variables or GitHub Actions secrets and never stored in repository files or command output.

The disk image is the primary end-user format. The compressed archive supports automated installs and environments where mounting a disk image is inconvenient. A Homebrew cask example is documented for future use, but publishing a tap is outside scope until a real repository and release URL exist.

## Continuous Integration and Release

GitHub Actions will use least-privilege permissions, pinned action major versions, dependency caches, and concurrency cancellation.

The CI workflow runs on pushes and pull requests. It performs:

- Repository policy and formatting checks.
- Rust build and deterministic tests.
- Editor dependency installation from the lockfile, type checking, tests with coverage, and production build.
- Swift tests and macOS application build on a macOS runner.

The release workflow is triggered by a semantic version tag in the form `vMAJOR.MINOR.PATCH`, with documented prerelease suffix support. It verifies that manifest and bundle versions match the tag, builds Universal 2 artifacts, signs and notarizes when secrets are configured, generates checksums, and uploads artifacts to a GitHub Release. The workflow summary prints release and artifact links on success. GitHub's native workflow notifications provide failure notification; maintainers may additionally subscribe or add an organization-specific notification integration later.

The release workflow never silently publishes a partially built artifact. Artifact creation, validation, and release publication are separate stages so a failed notarization or checksum step prevents publication.

## Versioning, Rollback, and Change Log

The project follows Semantic Versioning. The version is synchronized across Rust manifests, `editor/package.json`, and the macOS bundle before tagging. `CHANGELOG.md` follows Keep a Changelog with an `Unreleased` section.

Rollback does not delete or move a published tag. Maintainers mark a faulty GitHub Release as withdrawn, document the issue, revert the offending commits through normal Git history, and publish a new patch version. Compromised artifacts are removed from the release and their checksums are revoked in the release notes.

## Commit Strategy

Changes are committed as independently reviewable Conventional Commits:

1. Design specification.
2. Repository audit and prioritized open-source plan.
3. License and community health files.
4. Deterministic tests, type checks, and coverage commands.
5. macOS packaging and artifact validation.
6. CI and release automation.
7. Installation, CI, release, and top-level documentation.
8. Final changelog and delivery audit updates.

Each commit includes the tests or validation relevant to its behavior. Documentation is updated in the same commit as the interface it describes unless it is a standalone governance deliverable.

## Error Handling and Safety

Build scripts use strict shell settings, quote paths, resolve their repository root, validate required tools, and fail with specific remediation messages. Destructive cleanup is limited to known build output directories under the repository. Packaging runs in a temporary staging directory and does not overwrite installed applications.

Credentials are never required for local verification. Optional signing and notarization paths validate all required variables before invoking Apple tools. CI logs avoid printing secret-bearing commands or profiles.

## Acceptance Criteria

The milestone is complete when:

- Every requested governance, review, plan, installation, release, and CI file exists and is internally consistent.
- `make test` is deterministic in a normal macOS terminal and in CI, with environment-dependent cases classified explicitly.
- Type checking and coverage are available through documented one-command targets.
- A Universal 2 `.app`, `.dmg`, `.tar.gz`, and SHA-256 checksums can be built on macOS without credentials.
- The same release path supports Developer ID signing and notarization when valid credentials are supplied.
- Push and pull request CI verifies source quality, builds, and tests; semantic version tags publish validated GitHub Release artifacts.
- The final `CHANGELOG.md` records all user- and maintainer-visible changes.
- Remaining external prerequisites and experimental-platform limitations are listed as assumptions or pending work rather than reported as completed.
