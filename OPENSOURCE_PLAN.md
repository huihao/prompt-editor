# Prompt Editor Open-Source Readiness Plan

This register is derived from `CODE_REVIEW.md`. Priorities reflect the macOS-first release scope approved on 2026-08-12. Effort is an engineering estimate: XS (<2 hours), S (half day), M (1-2 days), L (3-5 days), XL (>1 week).

Status values are `Planned`, `In progress`, `Complete`, `Blocked`, or `Deferred`. A task is marked complete only after its validation evidence exists.

## P0

P0 items block a responsible public source or macOS binary release.

| ID | Problem | Impact | Solution | Effort | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P0-01 | No project license or package license metadata | Users cannot legally reuse the code; registries cannot classify it | Add MIT `LICENSE` for Kimi Wu and `license`/`publish` metadata to manifests | XS | `test -s LICENSE`; inspect Cargo metadata | Complete |
| P0-02 | Missing contribution, security, ownership, issue, and PR guidance | Unsafe vulnerability disclosure and inconsistent contributions | Add `CONTRIBUTING.md`, `SECURITY.md`, CODEOWNERS setup, issue forms, and PR template without inventing contacts | S | Required-file loop; parse YAML | Complete |
| P0-03 | Cargo lockfiles are ignored and absent from Git | Clean/offline builds resolve different versions or fail | Correct `.gitignore`; generate and commit core, Windows, and Linux application lockfiles where dependency graphs resolve | S | `cargo metadata --locked` for each supported/resolvable manifest | Complete |
| P0-04 | Rust tests depend on real clipboard and default user storage | `make test` fails in CI/headless sessions and can touch user data | Separate opt-in clipboard integration tests and inject a temporary FFI storage path | S | `make test-core` in a clean/headless environment | Complete |
| P0-05 | Strict TypeScript currently fails and is not part of root tests | Compile-time regressions can ship despite green Vitest | Fix source/test type errors, add raw module declarations and `make typecheck` | M | `make typecheck` | Complete |
| P0-06 | No unified lint/coverage/verify interface | Contributors and CI cannot reproduce the same quality gate | Add `make lint`, `make coverage`, and `make verify`; document optional coverage tools | M | Run all three targets | Complete |
| P0-07 | macOS builds are arm64-biased and silently fall back | Intel users may receive an incompatible app | Add strict Universal 2 build script and validate both app executable and Rust library slices | M | `lipo -archs build/PromptEditor.app/Contents/MacOS/PromptEditor` | Complete |
| P0-08 | No installable/checksummed macOS release artifact | Users must build or copy an ad hoc app | Produce versioned `.dmg`, `.tar.gz`, and SHA-256 files with deterministic staging | M | `make package-macos VERSION=0.1.0`; `shasum -a 256 -c` | Complete |
| P0-09 | No signing/notarization path | Downloaded apps trigger Gatekeeper friction; releases cannot meet normal macOS trust expectations | Add optional Developer ID signing/notarization with strict required mode and secret-safe variables | M | Static script tests; actual notarization remains external until credentials exist | Complete |
| P0-10 | No push/PR CI or tagged release workflow | Regressions and releases are manual and unaudited | Add least-privilege GitHub Actions for quality checks, macOS build, checksums, required signing, and GitHub Release | M | Parse workflow YAML; actual remote run after repository push | Complete |
| P0-11 | README and install/release documentation are incomplete or inaccurate | Users cannot reliably install, test, uninstall, or understand support status | Rewrite English-first README; add installation, CI, and release guides with experimental platform caveats | M | Required-file and local-link audit | Complete |
| P0-12 | No changelog/version consistency gate | Tags can disagree with manifests and user-visible changes are lost | Add Keep a Changelog file and tag-to-manifest checker | S | `scripts/check-version.sh v0.1.0` | Complete |

## P1

P1 items are strongly recommended for security, maintainability, or credible experimental-platform support. Items not required by the approved macOS release boundary may remain open.

| ID | Problem | Impact | Solution | Effort | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | AI API keys are plaintext in WebView localStorage | Other local code/profile access can expose provider credentials | Design backward-compatible migration to macOS Keychain and native secure stores; avoid logging values | L | Migration tests, Keychain integration test, old-config compatibility | Deferred |
| P1-02 | Native snippet wheel interpolates imported data into `innerHTML` | Crafted snippet/category data may inject markup/script into its WebView | Centralize escaping or build DOM nodes with `textContent`; add malicious-import regression tests | M | XCTest/jsdom injection fixtures | Deferred |
| P1-03 | Markdown converter preserves raw HTML | A future preview that injects output may permit XSS | Document unsanitized contract; sanitize at trust boundary or offer safe conversion API | M | Raw HTML/script/link protocol security tests | Deferred |
| P1-04 | Large editor modules mix state, UI, persistence, and bridges | High regression risk and difficult ownership | Incrementally split `editor.ts`, `bridge.ts`, snippet and template managers along existing interfaces | XL | Existing tests plus focused module tests | Deferred |
| P1-05 | Large Swift controllers embed UI, JavaScript, and process logic | Native behavior is difficult to test and review | Extract bridge handlers, process services, and snippet rendering components | XL | Swift unit tests and app smoke test | Deferred |
| P1-06 | Local storage schemas lack common migrations/export/retention | Upgrades or quota failures may lose prompts/configuration | Define versioned schemas, transactional migrations, export/import, and retention policy | L | Upgrade fixtures from every prior schema | Deferred |
| P1-07 | File scan failure can return demo files | Users may act on nonexistent paths | Remove production mock fallback; expose explicit unavailable/error state | S | Native failure contract test | Deferred |
| P1-08 | Shell integration edits startup files without documented backup/rollback guarantee | Users can be left with broken shell configuration | Make edits idempotent, back up exact files, add uninstall/restore tests | M | Temporary-home shell fixture tests | Deferred |
| P1-09 | Windows shell has obsolete/unverified dependencies and incomplete bridge | Windows support cannot be advertised as usable | Refresh Tauri path or repair v1 graph, remove unused dependencies, add Windows CI and installer | XL | Clean Windows runner build and smoke test | Deferred |
| P1-10 | Linux shell has dependency, X11 keycode, Wayland, and XDG gaps | Linux behavior varies or fails by desktop/distribution | Lock graph, use layout-aware shortcuts/portal, honor XDG paths, handle missing typing tools | XL | Ubuntu runner plus X11/Wayland integration tests | Deferred |
| P1-11 | No end-to-end native application test | Unit tests cannot catch broken embedded asset/bridge/package integration | Add macOS app launch, WebView load, bridge, and artifact smoke tests | L | Automated app launch and UI assertion on macOS CI | Deferred |
| P1-12 | Third-party notices are not generated | Binary distributions may omit required notices | Generate notices from locked Cargo/pnpm graphs and package them with releases | M | Notice audit against dependency metadata | Deferred |
| P1-13 | Diagnostic logs may retain sensitive prompt/terminal context | Support bundles can disclose user data | Define redaction, retention limit, export warning, and no-secret logging tests | M | Redaction tests and manual exported-log review | Deferred |
| P1-14 | Dependency/security audits are manual | Vulnerable or incompatible packages can enter unnoticed | Add scheduled `cargo audit`, pnpm audit policy, license allowlist, and secret scan | M | Scheduled workflow and known-fixture test | Deferred |

## P2

P2 items improve polish or reduce long-term maintenance cost without blocking the macOS release.

| ID | Problem | Impact | Solution | Effort | Validation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| P2-01 | `snippet-manager-ui-backup.ts` is an unreferenced 709-line duplicate | Type errors and review noise remain in production compilation | Prove it is unused, remove it or exclude it from production typecheck, retain history in Git | XS | `rg` import scan; build and tests | Complete |
| P2-02 | HTML escape helpers are duplicated | Fixes may not reach every rendering surface | Consolidate on a shared escape/DOM rendering utility incrementally | M | Injection unit tests for each consumer | Deferred |
| P2-03 | `editor/index.html` is a 4,336-line mixed HTML/CSS shell | Styling and accessibility changes are difficult to isolate | Split source styles/components while retaining single-file Vite output | L | Byte-equivalent behavior via build and UI snapshots | Deferred |
| P2-04 | macOS preferences and native history actions remain TODO | Menu actions are incomplete | Connect existing web panels or remove unavailable commands until implemented | S | XCTest and UI smoke test | Deferred |
| P2-05 | Root diagnostic/build scripts overlap | Maintenance fixes must be repeated | Deprecate redundant scripts behind shared safe helpers and documented Make targets | M | Shellcheck/Bats tests and compatibility commands | Deferred |
| P2-06 | Static website has no validation or release source of truth | Download links/content can become stale | Add HTML/accessibility/link checks and generate version/download data | M | Static-site CI | Deferred |
| P2-07 | Public FFI lacks formal safety/ownership documentation and rich errors | Native callers can misuse pointers or cannot diagnose failures | Add C header contracts and thread-local error retrieval without breaking ABI | M | C integration tests | Deferred |
| P2-08 | Corrupt JSON can silently reset stores | Users may perceive data loss without recovery | Preserve corrupt files, use atomic writes, and surface recovery UI | L | Corruption/crash recovery tests | Deferred |
| P2-09 | No Homebrew cask or `.pkg` | Managed/CLI installation options are limited | Publish a cask after a stable repository/release URL exists; consider `.pkg` only for managed deployment | M | Install/uninstall on clean macOS VM | Blocked |
| P2-10 | No automatic updater | Users must manually discover releases | Evaluate Sparkle after signed/notarized releases and privacy/update policy exist | L | Signed update feed and rollback test | Deferred |

## Assumptions and Missing External Information

- License owner is confirmed as Kimi Wu.
- No GitHub remote, repository URL, public maintainer handle, or security email is configured. Files must not invent them.
- No Apple Developer ID identity, team ID, notarization credentials, or signing certificate is available in the repository. The implementation can provide and statically test the path, but only the owner can complete credential-backed notarization.
- No Homebrew tap exists. A future cask requires stable public release URLs and checksums.
- This environment is macOS arm64. Swift tests and Universal 2 packaging were verified outside the restricted execution sandbox; GitHub-hosted macOS CI remains the clean-runner authority.
- Windows/Linux GUI behavior cannot be validated on this host and remains experimental.

## Execution Order

1. Complete P0-01 through P0-03 (legal/governance/reproducibility).
2. Complete P0-04 through P0-06 and P2-01 (deterministic quality layer).
3. Complete P0-07 through P0-09 and P0-12 (macOS packaging/versioning).
4. Complete P0-10 (CI/release automation).
5. Complete P0-11 and reconcile this plan, `CODE_REVIEW.md`, and `CHANGELOG.md` with actual evidence.
6. Schedule P1 security and platform items before expanding support claims.
