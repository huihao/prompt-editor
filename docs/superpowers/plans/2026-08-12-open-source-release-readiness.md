# Open-Source and Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Prompt Editor publicly distributable, reproducibly testable, and continuously releasable as a macOS Universal 2 application.

**Architecture:** Preserve the Rust core, TypeScript editor, and Swift/AppKit shell while adding deterministic root-level quality commands, isolated platform packaging scripts, and GitHub Actions workflows. Treat macOS as supported and Windows/Linux as experimental, with every unverifiable external prerequisite documented explicitly.

**Tech Stack:** Rust/Cargo, TypeScript/Vite/Vitest/pnpm, Swift Package Manager/AppKit, POSIX shell, Make, GitHub Actions, Apple `codesign`, `notarytool`, `stapler`, `hdiutil`, and `lipo`.

---

## File Map

- `CODE_REVIEW.md`: complete repository audit, dependency/license inventory, quality findings, and portability/security scans.
- `OPENSOURCE_PLAN.md`: P0/P1/P2 remediation register with impact, effort, validation, and completion status.
- `LICENSE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`: public project and governance contract.
- `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md`: contribution routing and templates.
- `Makefile`: stable local lint, test, coverage, verify, build, and package interface.
- `core/src/clipboard.rs`, `core/src/lib.rs`, `core/src/storage.rs`: deterministic clipboard and FFI storage tests.
- `editor/package.json`, `editor/pnpm-lock.yaml`, `editor/src/vite-env.d.ts`, selected TypeScript sources/tests: type checking and coverage.
- `scripts/build-macos.sh`: build and assemble a Universal 2 application bundle.
- `scripts/package-macos.sh`: validate, optionally sign/notarize, archive, create disk image, and checksum artifacts.
- `scripts/check-version.sh`: ensure a release tag matches every project version source.
- `.github/workflows/ci.yml`, `.github/workflows/release.yml`: continuous verification and tagged release publication.
- `docs/INSTALLATION.md`, `docs/RELEASING.md`, `CI.md`: installation, release, signing, rollback, and pipeline documentation.

### Task 1: Repository Audit and Prioritized Plan

**Files:**
- Create: `CODE_REVIEW.md`
- Create: `OPENSOURCE_PLAN.md`

- [ ] **Step 1: Generate tracked-source evidence**

Run:

```bash
git ls-files
rg -n --hidden -g '!.git/**' -g '!.worktrees/**' -g '!**/node_modules/**' -g '!**/target/**' -g '!**/.build/**' '(TODO|FIXME|HACK|XXX|/Users/|/home/|[A-Za-z]:\\)' .
cargo metadata --manifest-path core/Cargo.toml --format-version 1 --locked
```

Expected: a complete tracked file list, classified marker/path matches, and resolved Rust dependency metadata.

- [ ] **Step 2: Write the complete audit**

Create `CODE_REVIEW.md` with the confirmed directory tree, module responsibility and quality tables, direct resolved dependency versions/licenses, transitive-license families, credential scan results, hard-coded paths, markers, cross-platform risks, missing types/comments/standards, baseline test results, and MIT recommendation for `Kimi Wu`.

- [ ] **Step 3: Write the remediation register**

Create `OPENSOURCE_PLAN.md` with P0/P1/P2 tables. Every row must include ID, problem, impact, solution, effort, validation, and status. External Apple/GitHub/Homebrew configuration must remain pending rather than claimed complete.

- [ ] **Step 4: Validate document completeness**

Run:

```bash
rg -n '^## (Project Structure|Code Quality|Dependencies and License Compatibility|Hard-Coded Paths and Sensitive Information|TODO and FIXME Inventory|Cross-Platform Compatibility|Standards, Comments, and Types|License Recommendation)' CODE_REVIEW.md
rg -n '^## P[012]' OPENSOURCE_PLAN.md
git diff --check
```

Expected: every required audit and priority heading is present and no whitespace errors are reported.

- [ ] **Step 5: Commit**

```bash
git add CODE_REVIEW.md OPENSOURCE_PLAN.md
git commit -m "docs: audit open-source readiness"
```

### Task 2: License and Community Health

**Files:**
- Create: `LICENSE`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `.github/CODEOWNERS`
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`
- Create: `.github/pull_request_template.md`
- Modify: `.gitignore`
- Modify: `core/Cargo.toml`
- Modify: `linux/Cargo.toml`
- Modify: `windows/Cargo.toml`

- [ ] **Step 1: Add the public license and package metadata**

Use the standard MIT text with `Copyright (c) 2026 Kimi Wu`. Add `license = "MIT"`, concise descriptions, and `publish = false` to application manifests; keep the reusable core private until repository metadata is known.

- [ ] **Step 2: Add governance documents and templates**

Document issue reproduction, platform support, test commands, Conventional Commits, responsible security reporting without inventing an email address, and CODEOWNERS fallback to the confirmed GitHub-style owner token only if it can be derived safely. If no GitHub handle is known, explain setup in the file and use a syntactically valid placeholder that blocks automatic ownership claims.

- [ ] **Step 3: Correct ignore rules**

Keep lockfiles tracked for applications, remove broad `*.test` and `*.spec` patterns, ignore all generated coverage directories, signing material, notarization profiles, packaged archives, and local Apple credential files.

- [ ] **Step 4: Validate governance files**

Run:

```bash
test -f LICENSE && test -f CONTRIBUTING.md && test -f SECURITY.md
test -f .github/ISSUE_TEMPLATE/bug_report.yml
git check-ignore core/Cargo.lock && exit 1 || true
git diff --check
```

Expected: required files exist, `core/Cargo.lock` is no longer ignored, and the diff is clean.

- [ ] **Step 5: Commit**

```bash
git add LICENSE CONTRIBUTING.md SECURITY.md .gitignore .github core/Cargo.toml linux/Cargo.toml windows/Cargo.toml core/Cargo.lock
git commit -m "chore: add open-source governance"
```

### Task 3: Deterministic Tests and Type Checking

**Files:**
- Modify: `core/src/clipboard.rs`
- Modify: `core/src/lib.rs`
- Modify: `core/src/storage.rs`
- Modify: `editor/package.json`
- Modify: `editor/pnpm-lock.yaml`
- Create: `editor/src/vite-env.d.ts`
- Modify: `editor/src/ai-service.ts`
- Modify: `editor/src/snippet-manager.ts`
- Modify: `editor/src/template-edit-mode.ts`
- Modify: `editor/src/template/inline-template-editor.ts`
- Modify: `editor/src/template/template-renderer.ts`
- Modify: selected `editor/src/__tests__/*.test.ts`
- Modify: `editor/tsconfig.json`
- Modify: `Makefile`

- [ ] **Step 1: Make current failures explicit**

Run:

```bash
make test-core
make test-editor
cd editor && corepack pnpm exec tsc --noEmit
```

Expected before changes: Rust clipboard/default-storage failures in a headless or restricted session, 174 passing editor tests, and the recorded TypeScript errors.

- [ ] **Step 2: Isolate Rust tests**

Mark real clipboard round-trip cases as ignored integration tests with an exact opt-in command, retain deterministic null/error FFI coverage, and add a test-only storage path override or helper so `pe_save_prompt` writes only inside a `tempfile::TempDir`. Replace manual shared temporary filenames with `tempfile` where practical.

- [ ] **Step 3: Add editor type checking and coverage**

Add scripts:

```json
"typecheck": "tsc --noEmit",
"coverage": "vitest run --coverage"
```

Add the pinned Vitest v1-compatible coverage provider, raw HTML module declarations, and exclusions for intentionally retained non-production backup source if it is unreferenced.

- [ ] **Step 4: Correct source and test types without behavior changes**

Use the AI SDK finish event's `totalUsage`, complete required category descriptions, type recursive category lookups, widen template field values to include booleans consistently, and provide generic mock implementations matching native client interfaces.

- [ ] **Step 5: Expand root quality commands**

Add `typecheck`, `lint`, `coverage`, and `verify` targets. `lint` runs `cargo fmt --check`, `cargo clippy -- -D warnings`, TypeScript checking, and `swiftformat` only when configured; do not auto-format user code. `coverage` checks for `cargo llvm-cov` and prints the exact install command if absent while always producing editor coverage.

- [ ] **Step 6: Verify the quality layer**

Run:

```bash
make test-core
make test-editor
make typecheck
make lint
make coverage
```

Expected: deterministic tests and type checks pass; coverage reports are produced, or the Rust coverage target exits with a clear tool-installation message as designed.

- [ ] **Step 7: Commit**

```bash
git add core/src editor Makefile
git commit -m "test: make quality checks reproducible"
```

### Task 4: Universal macOS Build and Packages

**Files:**
- Create: `scripts/build-macos.sh`
- Create: `scripts/package-macos.sh`
- Create: `scripts/check-version.sh`
- Modify: `Makefile`
- Modify: `build.sh`

- [ ] **Step 1: Add shell contract tests through syntax and failure cases**

Before implementing successful packaging, define validation commands for Linux rejection, invalid versions, missing tools, incomplete signing variables, and paths containing spaces. Scripts must use `set -euo pipefail`, resolve `REPO_ROOT`, and limit cleanup to staging/output paths under the repository.

- [ ] **Step 2: Implement Universal 2 app assembly**

Build both Rust targets, combine the static library with `lipo`, build Swift for both architectures, combine the executable if SwiftPM does not emit a universal binary, assemble the bundle, and validate `lipo -archs` contains both `arm64` and `x86_64`.

- [ ] **Step 3: Implement archives, signing, notarization, and checksums**

Support these environment variables without printing values:

```text
MACOS_SIGNING_IDENTITY
APPLE_TEAM_ID
APPLE_ID
APPLE_APP_PASSWORD
MACOS_REQUIRE_SIGNING
```

Create `PromptEditor-<version>-macos-universal.tar.gz`, `PromptEditor-<version>-macos-universal.dmg`, and `.sha256` files. Sign and notarize only when configured; fail when `MACOS_REQUIRE_SIGNING=1` and configuration is incomplete.

- [ ] **Step 4: Add version consistency validation**

Compare a supplied `vX.Y.Z` tag with `core/Cargo.toml`, `editor/package.json`, `linux/Cargo.toml`, `windows/Cargo.toml`, and `CFBundleShortVersionString`. Reject malformed tags and mismatches with file-specific messages.

- [ ] **Step 5: Wire Make and legacy build entry points**

Make `make macos` call the canonical build script and add `make package-macos VERSION=0.1.0`. Keep `./build.sh` backward compatible by delegating its macOS branch to the same script.

- [ ] **Step 6: Verify packaging**

Run:

```bash
bash -n scripts/build-macos.sh scripts/package-macos.sh scripts/check-version.sh build.sh
scripts/check-version.sh v0.1.0
make package-macos VERSION=0.1.0
shasum -a 256 -c build/release/*.sha256
```

Expected on a normal macOS host: a valid Universal 2 app, DMG, tarball, and passing checksums. In the managed sandbox, record any Apple tool sandbox restriction separately after syntax and static validation pass.

- [ ] **Step 7: Commit**

```bash
git add scripts Makefile build.sh
git commit -m "build: package universal macOS releases"
```

### Task 5: Continuous Integration and Tagged Releases

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Add push and pull request CI**

Use least-privilege `contents: read`, concurrency cancellation, pinned Node/Rust setup actions, Corepack with the committed pnpm lockfile, and separate core/editor/macOS jobs. Run format, clippy, typecheck, tests, coverage, production editor build, Swift tests, and macOS app assembly.

- [ ] **Step 2: Add release workflow**

Trigger on `v*.*.*` tags. Validate versions, import an optional base64 signing certificate into a temporary keychain, run `make package-macos`, require notarization when release credentials are configured, upload artifacts for job handoff, then create a GitHub Release with generated notes and checksum assets using `contents: write` only in the publishing job.

- [ ] **Step 3: Validate workflow structure**

Run:

```bash
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/ci.yml"); YAML.load_file(".github/workflows/release.yml")'
rg -n 'permissions:|concurrency:|pull_request:|push:|contents: write|upload-artifact|download-artifact' .github/workflows
git diff --check
```

Expected: YAML parses and required triggers, permissions, concurrency, and artifact boundaries are present.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows
git commit -m "ci: automate checks and macOS releases"
```

### Task 6: Installation, Release, CI, and Project Documentation

**Files:**
- Create: `docs/INSTALLATION.md`
- Create: `docs/RELEASING.md`
- Create: `CI.md`
- Rewrite: `README.md`
- Create: `CHANGELOG.md`
- Modify: `OPENSOURCE_PLAN.md`

- [ ] **Step 1: Document installation and removal**

Cover DMG, tarball, source build, Apple Silicon and Intel behavior, Gatekeeper for unsigned development artifacts, application data locations, uninstall commands, Accessibility/Automation permission reset, and common failures. Explain when DMG, archive, future cask, and pkg formats are appropriate.

- [ ] **Step 2: Document release operations**

Cover Semantic Versioning, version synchronization, changelog updates, clean verification, required/optional GitHub secrets, Developer ID certificate import, `notarytool`, tag creation, workflow monitoring, artifact verification, withdrawal, revert, and patch-release rollback.

- [ ] **Step 3: Document CI stages**

Map each workflow job to its command, runner, inputs, outputs, permissions, cache, failure notification, and artifact link location.

- [ ] **Step 4: Rewrite the top-level README in English**

Include description, features, screenshots/assets only if existing real assets are available, support matrix, installation links, usage, architecture, prerequisites, exact build/test commands, contribution/security links, experimental platform caveats, and MIT license. Retain concise Chinese notes only where useful.

- [ ] **Step 5: Add the changelog and update plan statuses**

Use Keep a Changelog structure with `Unreleased` and `0.1.0` context. Record governance, deterministic testing, macOS packages, CI, and documentation. Mark only verified `OPENSOURCE_PLAN.md` items complete and retain external configuration as pending.

- [ ] **Step 6: Validate documentation links and delivery files**

Run:

```bash
for file in CODE_REVIEW.md OPENSOURCE_PLAN.md LICENSE README.md CONTRIBUTING.md CHANGELOG.md SECURITY.md .gitignore docs/INSTALLATION.md docs/RELEASING.md CI.md .github/workflows/ci.yml .github/workflows/release.yml scripts/build-macos.sh scripts/package-macos.sh; do test -s "$file" || exit 1; done
rg -n '\[[^]]+\]\([^)]*\)' README.md CONTRIBUTING.md SECURITY.md CI.md docs/INSTALLATION.md docs/RELEASING.md
git diff --check
```

Expected: every deliverable is non-empty and no malformed local references or whitespace errors are found during manual review.

- [ ] **Step 7: Commit**

```bash
git add README.md CHANGELOG.md CI.md docs/INSTALLATION.md docs/RELEASING.md OPENSOURCE_PLAN.md
git commit -m "docs: publish installation and release guides"
```

### Task 7: Final Verification and Delivery Audit

**Files:**
- Modify: `CODE_REVIEW.md`
- Modify: `OPENSOURCE_PLAN.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the full clean verification**

Run:

```bash
make verify
make package-macos VERSION=0.1.0
shasum -a 256 -c build/release/*.sha256
git diff --check
git status --short
```

Expected: all supported checks pass on macOS and release artifacts validate. Any managed-sandbox-only limitation must include the exact failed command and preserved successful checks.

- [ ] **Step 2: Re-run security and marker scans**

Run:

```bash
rg -n --hidden -g '!.git/**' -g '!.worktrees/**' -g '!**/node_modules/**' -g '!**/target/**' -g '!build/**' '(TODO|FIXME|HACK|XXX)' .
rg -n --hidden -g '!.git/**' -g '!**/node_modules/**' '(sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|BEGIN [A-Z ]*PRIVATE KEY)' .
```

Expected: only documented sample/fixture/known-debt markers and no credential material.

- [ ] **Step 3: Reconcile audit, plan, and changelog**

Record final command evidence, artifact names, completed plan IDs, and remaining external prerequisites. Do not mark Windows/Linux GUI validation, Apple notarization, GitHub publication, or Homebrew publication complete without actual evidence.

- [ ] **Step 4: Commit the final evidence**

```bash
git add CODE_REVIEW.md OPENSOURCE_PLAN.md CHANGELOG.md
git commit -m "docs: record release readiness verification"
```

- [ ] **Step 5: Inspect commit and worktree integrity**

Run:

```bash
git log --oneline --decorate -10
git status --short
git diff HEAD~7..HEAD --check
```

Expected: isolated Conventional Commits, a clean worktree except intentionally generated ignored artifacts, and no diff-check failures.
