# Prompt Editor Code Review

Review date: 2026-08-12  
Reviewed revision: `93a424f`  
Scope: every Git-tracked source, build, configuration, test, and documentation file. Generated output, dependencies, `.git`, and other worktrees are excluded.

## Executive Summary

Prompt Editor has a credible macOS-first architecture and substantial unit coverage in its TypeScript editor and Swift shell. Its strongest boundaries are the native-client TypeScript adapters and the per-agent prompt-memory parsers. Its main open-source blockers are the absence of a license and community files, untracked Rust lockfiles, nondeterministic Rust tests, no CI or release packaging, existing strict TypeScript errors, and inaccurate claims that Windows and Linux are equivalent to macOS.

Two product-security debts require follow-up beyond release engineering: AI API keys are stored as plaintext WebView `localStorage`, and several HTML-building paths require continued escaping discipline. No committed credential or private key was detected. The recommended project license is MIT.

## Project Structure

```text
prompt-editor/
├── core/                    Rust storage, scanning, Markdown, clipboard, and C FFI
├── editor/                  CodeMirror/Vite editor, browser logic, adapters, and tests
│   ├── data/                Built-in prompt snippets
│   └── src/
│       ├── __tests__/       23 Vitest unit/contract test files
│       ├── platform/        Browser, WKWebView, Tauri, and Linux clients
│       └── template/        Template parsing, rendering, editing, and persistence
├── macos/                   SwiftPM AppKit/WKWebView application and XCTest suite
├── windows/                 Experimental Tauri v1 shell
├── linux/                   Experimental GTK4/WebKitGTK shell
├── website/                 Static informational website
├── docs/                    Diagnostics, support matrix, designs, and plans
├── Makefile                 Root build/test entry points
└── *.sh / diagnostic.js    Legacy build, repair, and diagnostic utilities
```

### Directory Responsibilities

| Path | Responsibility | Assessment |
| --- | --- | --- |
| `core/` | Platform-neutral persistence, file scanning, Markdown conversion, clipboard, C ABI | Cohesive modules and broad tests; FFI is concentrated in one large file and default-path/clipboard tests are environment-dependent. |
| `editor/` | Main editing experience and embedded single-file web bundle | Feature-rich and well tested, but large stateful modules, repeated HTML escaping, direct DOM templating, and current type-check failures increase maintenance risk. |
| `macos/` | Supported AppKit host, bridges, terminal integration, prompt-memory scanning | Most complete platform; substantial test suite, but several 300-1,000 line controllers mix UI, process execution, bridge code, and state. |
| `windows/` | Experimental Tauri host | Small MVP with unchecked `unwrap`/`expect`, obsolete Tauri v1 constraints, incomplete frontend integration, and no verified build. |
| `linux/` | Experimental GTK/WebKit host | Prototype-quality single file; fixed X11 keycode, external `wtype`/`xdotool` reliance, incomplete Wayland behavior, and no committed lockfile. |
| `website/` | Static product pages and localization | Isolated and simple, but not connected to an automated build, accessibility check, or release URL source. |
| `docs/` | Operational notes, support matrix, historical specs/plans | Useful evidence, but mostly Chinese and some verification notes embed stale dates/checksums and machine-specific examples. |
| root scripts | Builds, cache clearing, diagnostics, and ad hoc regression checks | Helpful during development but duplicated, macOS-heavy, and destructive commands need tighter path validation and consolidation. |

## Code Quality

### Rust Core

| File | Quality assessment |
| --- | --- |
| `core/src/lib.rs` (511 lines) | All C ABI functions and global stores live together. Null checks are generally present, but errors collapse to `-1`/null with no diagnostic channel. Unsafe pointer conversion is localized but undocumented with Rust `# Safety` contracts. Test-only access to default storage is not injectable. |
| `core/src/template_storage.rs` (575) | Clear domain types and CRUD tests, but template and data-source stores duplicate open/load/flush/search patterns. Corrupt JSON silently falls back in related stores, which can conceal data loss. |
| `core/src/file_scanner.rs` (405) | Reasonable ignore/search/cache separation and temporary-directory tests. Full-tree scans can be expensive; ignore policy is hard-coded and lacks cancellation or symlink policy documentation. |
| `core/src/storage.rs` (365) | Readable CRUD API with good behavior coverage. Writes are not atomic, corruption falls back silently, and `~/.prompt-editor` is a legacy hard-coded policy rather than an OS application-support directory. Tests manually manage temporary filenames. |
| `core/src/markdown.rs` (220) | Straightforward `pulldown-cmark` wrapper with broad syntax tests. Raw HTML passthrough is intentional and must not be treated as sanitized output. |
| `core/src/clipboard.rs` (26) | Minimal wrapper; its only test requires a working real clipboard and fails in headless/restricted environments. |
| `core/build.rs`, `cbindgen.toml`, generated header | Simple binding generation. Build errors are explicit; generated `core/include/prompt_editor.h` policy conflicts with the checked-in copy under `macos/Libraries`. |

### TypeScript Editor

| Files | Quality assessment |
| --- | --- |
| `editor/src/editor.ts` (955), `bridge.ts` (605) | Central orchestration files carry many unrelated event, storage, UI, and native bridge responsibilities. Readability is acceptable locally, but change blast radius and implicit global state are high. |
| `snippet-manager.ts` (877), `snippet-manager-ui.ts` (701), `snippet-wheel.ts` (364) | Domain/UI split is useful and recent escaping tests are strong. Recursive category logic is complex, logging is noisy in tests, and `snippet-manager-ui-backup.ts` is a 709-line unreferenced duplicate that still enters TypeScript compilation. |
| `template/*.ts` (11 files, many 329-621 lines) and `template-edit-mode.ts` (448) | Broad feature coverage and interfaces exist, but value types disagree about booleans, rendering/validation logic is repeated, and several managers combine persistence with UI. |
| `ai-config.ts`, `ai-service.ts`, `ai-enhance.ts`, `ai-autocomplete.ts`, `ai-usage.ts` | Provider definitions and service boundaries are understandable. API keys are serialized to plaintext localStorage; provider HTML values need escaping; an AI SDK finish-event field is typed incorrectly. No network integration suite exists. |
| `prompt-orchestration*.ts`, `prompt-workflow-store.ts` | Parsing and store logic are separated and tested. UI module remains large and template-string heavy, but dynamic prompt fields are escaped. |
| `history-store.ts`, `prompt-memory*.ts`, `workspace-manager.ts`, `image-paste.ts` | Defensive parsing is generally good. Several stores use localStorage/IndexedDB without a shared migration/versioning policy; Data URL images can exceed storage quotas. |
| `file-*.ts`, `format-converter.ts`, `terminal-context.ts` | Responsibilities are discoverable, but `file-reference.ts` can return demo/mock files after native failure, which risks presenting nonexistent data as real. Example absolute paths are UI examples, not runtime hard-coding. |
| `platform/*.ts` | Best-defined editor boundary: a typed client contract with platform adapters and 19 contract tests. Generic mock typing currently fails strict `tsc`. |
| `i18n.ts`, `theme.ts`, `settings-ui.ts`, `send-feature.ts`, `snippet-rendering.ts`, `logger.ts` | Mostly focused modules. Localization is an in-source dictionary rather than a scalable resource pipeline; logger persists potentially sensitive diagnostics to localStorage. |
| `editor/index.html` (4,336) | Contains the entire visual shell and CSS. Single-file packaging is deliberate, but this size makes style ownership, accessibility review, and dead-code detection difficult. |
| `editor/src/__tests__/*.test.ts` | 23 files and 174 passing tests cover stores, bridges, AI flows, snippets, templates, and UI contracts. Tests are predominantly unit/jsdom; there is no real native integration or end-to-end application test. Several mocks and raw imports fail strict type checking. |

### macOS Swift Shell

| Files | Quality assessment |
| --- | --- |
| `SnippetWheelWindow.swift` (991) | Largest Swift hotspot. It embeds substantial HTML/JavaScript and duplicates web snippet rendering. Dynamic category/snippet strings are interpolated into `innerHTML` without a consistently visible escape boundary, creating an injection risk for imported custom snippets. |
| `MainWindow.swift` (575), `AppDelegate.swift` (380) | Functional AppKit/WKWebView coordination, but message dispatch, process discovery, preferences, history, and view lifecycle are mixed. Two user-facing handlers remain TODOs. |
| `ShellIntegrationScripts.swift` (459), `AgentDetector.swift` (366), `TerminalSender.swift` (299), `TerminalCaptureServer.swift` (301) | Useful platform capability with tests around helpers. Process execution and shell configuration are sensitive surfaces; shell edits need backup/rollback and stronger executable/path validation. |
| `PromptMemoryParser.swift`, `PromptMemoryScanner.swift`, `PromptMemoryModels.swift`, five parser files | Clear protocol boundary and the most modular Swift subsystem. Parser-specific files are small and supported by fixture-driven tests. |
| `Helpers.swift`, `SnippetDataManager.swift`, `StatusBarItem.swift`, `main.swift` | Focused support code. JavaScript escaping helpers are important and tested; status/main entry points are simple. |
| `macos/Tests/*` | 819-line XCTest suite covers escaping, bridge contracts, agent parsing, and scanning. It is broad but monolithic; SwiftPM test execution could not be completed inside the managed nested sandbox. |

### Experimental Platforms, Website, and Scripts

| File group | Quality assessment |
| --- | --- |
| `windows/src/main.rs`, `build.rs`, `tauri.conf.json` | Prototype implementation with PowerShell keystroke injection, broad command use, and multiple UI `unwrap`s. `arrow-key` appears unused. Tauri v1 is legacy and a clean build is not established. |
| `linux/src/main.rs`, `Cargo.toml` | One file owns UI, WebKit, clipboard, shortcut thread, and external typing. Keycode `65` varies by layout; GTK access from thread-local state is questionable; Wayland feature declares a dependency but no implementation. |
| `website/*.html`, `assets/*` | Plain static files with no framework dependency. Content/release links require synchronization and automated HTML/accessibility validation. |
| `build.sh`, `Makefile` | Understandable entry points, but macOS build forces arm64 in places, silently falls back from cross-architecture failures, duplicates assembly steps, and has no package/sign/notarize/checksum stage. |
| `clear-cache.sh`, `debug.sh`, `force-clean-rebuild.sh`, `one-click-diagnostic.sh`, `quick-update.sh`, `diagnostic.js`, `test-*.sh` | Operational scripts overlap heavily and include host-specific process/cache behavior. They lack a shared library, consistent strict mode, shell linting, and uniform path guards. Keep for compatibility, then consolidate gradually. |

## Dependencies and License Compatibility

### JavaScript Direct Dependencies

Resolved versions come from committed `editor/pnpm-lock.yaml` and installed package metadata.

| Dependency group | Declared range | Resolved | License |
| --- | --- | --- | --- |
| `@ai-sdk/anthropic` | `^3.0.81` | 3.0.81 | Apache-2.0 |
| `@ai-sdk/google` | `^3.0.80` | 3.0.80 | Apache-2.0 |
| `@ai-sdk/openai` | `^3.0.67` | 3.0.67 | Apache-2.0 |
| `ai` | `^6.0.193` | 6.0.193 | Apache-2.0 |
| `@codemirror/autocomplete` | `^6.20.1` | 6.20.1 | MIT |
| `@codemirror/commands` | `^6.10.3` | 6.10.3 | MIT |
| `@codemirror/lang-markdown` | `^6.2.0` | 6.5.2 | MIT |
| `@codemirror/language` | `^6.12.3` | 6.12.3 | MIT |
| `@codemirror/language-data` | `^6.5.0` | 6.5.2 | MIT |
| `@codemirror/state` | `^6.4.0` | 6.6.0 | MIT |
| `@codemirror/view` | `^6.26.0` | 6.41.1 | MIT |
| `@lezer/highlight` | `^1.2.3` | 1.2.3 | MIT |
| `codemirror` | `^6.0.0` | 6.0.2 | MIT |
| `jsdom` | `^24.0.0` | 24.1.3 | MIT |
| `typescript` | `^5.4.0` | 5.9.3 | Apache-2.0 |
| `vite` | `^5.4.0` | 5.4.21 | MIT |
| `vite-plugin-singlefile` | `^2.0.0` | 2.3.3 | MIT |
| `vitest` | `^1.6.0` | 1.6.1 | MIT |

### Rust Direct Dependencies

Rust lockfiles were ignored and not tracked at the reviewed revision. “Local resolved” values are evidence from the developer checkout, not reproducible repository guarantees. Linux has no usable lock snapshot, so only declared constraints are reported.

| Component / dependency | Constraint | Local resolved | License |
| --- | --- | --- | --- |
| core: `arboard` | `3` | 3.6.1 | MIT OR Apache-2.0 |
| core: `pulldown-cmark` | 0.10 | 0.10.3 | MIT |
| core: `serde`, `serde_json` | 1 | 1.0.228 / 1.0.149 | MIT OR Apache-2.0 |
| core: `dirs` | 5 | 5.0.1 | MIT OR Apache-2.0 |
| core: `chrono` | 0.4 | 0.4.44 | MIT OR Apache-2.0 |
| core: `lazy_static` | 1 | 1.5.0 | MIT OR Apache-2.0 |
| core build/dev: `cbindgen`, `tempfile` | 0.26 / 3 | 0.26.0 / 3.27.0 | MPL-2.0 / MIT OR Apache-2.0 |
| Windows: `tauri` | 1.6 | 1.8.3 | Apache-2.0 OR MIT |
| Windows: `clipboard-win` | 5.3 | 5.4.1 | BSL-1.0 |
| Windows: `serde`, `serde_json` | 1 | 1.0.228 / 1.0.149 | MIT OR Apache-2.0 |
| Windows: `arrow-key` | 0.2 | unresolved locally | Metadata must be verified before a Windows release |
| Linux: `gtk4`, `webkit6`, `glib`, `gio` | 0.8 / 0.4 / 0.19 / 0.19 | not locked | MIT-family crates plus system library licenses; verify distribution obligations |
| Linux: `x11rb`, `wayland-client` | 0.13 / 0.31 | not locked | MIT OR Apache-2.0 |
| Linux: `cli-clipboard`, `libc` | 0.4 / 0.2 | not locked | Apache-2.0/MIT-family; verify resolved graph |

The local core transitive graph contains permissive MIT, Apache-2.0, BSD/0BSD, Zlib, Unlicense, BSL-1.0, and MPL-2.0 components. It also includes target-conditional `r-efi` metadata offering LGPL-2.1-or-later as one option alongside permissive alternatives; selecting a permissive offered license is compatible. MPL-2.0 obligations apply to modifications of MPL-covered dependency files, not to the entire combined application. No GPL-only direct dependency was identified.

Swift uses Apple system frameworks and has no external Swift package dependency. System GTK/WebKit licensing and bundled notices must be reviewed before shipping Linux binaries.

## Hard-Coded Paths and Sensitive Information

### Path Inventory

| Location | Classification | Impact |
| --- | --- | --- |
| `core/src/storage.rs` | Runtime `~/.prompt-editor/prompts.json` | Portable across Unix home directories but not aligned with macOS Application Support or Windows known folders. Preserve for compatibility until migration exists. |
| `core/src/template_storage.rs` | Runtime paths under `~/.prompt-editor` | Same migration/backup concern as prompt storage. |
| `linux/src/main.rs` | `/usr/local/share:/usr/share`, relative `../editor/dist` | Linux-specific and valid as fallbacks, but ignores per-user XDG data home and fragile executable-relative layout. |
| root scripts | macOS `~/Library/*`, `/tmp`, `/Applications`, `~/Applications` | Expected platform paths, but repair scripts need strict scope validation and Windows alternatives. |
| `editor/src/file-picker.ts` | `/Users/user/project`, `/home/user/project`, `C:\Users\user\project` | UI examples covering all platforms, not live paths. |
| editor/macOS tests | `/Users/example`, `/Users/tester`, `/tmp`, Windows path literals | Deterministic fixtures, not runtime leakage. |
| historical plan docs | `/Users/huihao/...` | Developer-specific historical evidence. Harmless at runtime, but reduce in future public plans. |

### Sensitive-Data Scan

No strings matching common OpenAI, AWS, GitHub token, or PEM private-key patterns were found in tracked source. `.claude/settings.local.json`, local environment files, build output, and worktrees are ignored. The pnpm integrity string containing `XXX` is a checksum coincidence, not a marker or secret.

Runtime sensitivity remains:

- `editor/src/ai-config.ts` stores provider API keys unencrypted in persistent localStorage.
- `editor/src/logger.ts` persists diagnostic records; callers must not log prompts, API keys, or terminal output.
- prompt history, snippets, workspaces, images, workflows, and usage statistics are stored locally without a documented retention/export policy.
- CI signing/notarization credentials do not exist yet; future workflows must accept them only through repository secrets.

## TODO and FIXME Inventory

Actionable tracked-code markers are complete as of the review date:

| Location | Marker | Assessment |
| --- | --- | --- |
| `macos/PromptEditor/AppDelegate.swift:355` | preferences window | P2 product debt; menu action has no full preferences window. |
| `macos/PromptEditor/MainWindow.swift:191` | show history panel | P1 incomplete native bridge behavior; web history UI exists. |
| `linux/Cargo.toml:18` | Wayland | P1 experimental-platform gap; dependency exists without implemented shortcut integration. |

Non-actionable matches:

- `editor/data/snippets.json` contains the literal words TODO/FIXME as prompt content.
- `editor/pnpm-lock.yaml` contains `XXX` inside a SHA-512 integrity value.
- `docs/feature-support-matrix.md` reports the same known product gaps.
- `docs/superpowers/*` contains historical examples and audit commands.

No source `FIXME`, `HACK`, or standalone `XXX` debt marker was found.

## Cross-Platform Compatibility

### macOS

- Current canonical build paths disagree: `build.sh` forces arm64; `Makefile` attempts both architectures but silently accepts failure and then invokes `arch -arm64 swift build`.
- The app targets macOS 12, uses AppKit/WebKit, and needs Accessibility permission for terminal paste. Distribution requires Developer ID signing, hardened runtime, notarization, and clear unsigned-development instructions.
- Intel cannot be claimed until both Rust and Swift executable slices are verified with `lipo` on CI.
- Shell integration supports Unix shells but editing startup files needs backups and reversible uninstall steps.

### Linux

- GTK4/WebKitGTK system package names differ across distributions.
- The X11 shortcut uses fixed keycode 65, which is keyboard-layout dependent.
- Wayland compositors generally prohibit the X11 global-grab approach; the current feature only prints guidance and has no `--toggle` implementation demonstrated.
- Sending depends on external `wtype` or `xdotool`; errors are discarded.
- `XDG_DATA_HOME` is not checked, and the fallback HTML path is fragile.

### Windows

- Tauri v1 dependencies and frontend asset configuration are not verified in CI.
- PowerShell `keybd_event` automation is Windows-specific, may be restricted by security policy, and ignores child process failures.
- The product shortcut differs from macOS and may conflict with system/window-manager behavior.
- Application data paths and installer/uninstaller behavior are unspecified.

### Shared Web Layer

- Browser, WKWebView, Tauri, and Linux adapters expose different capabilities despite a useful common contract.
- `file://` loading, CORS behavior for AI providers, clipboard permission, and localStorage quota differ by host.
- Example path handling includes POSIX and Windows syntax, but real file scanning is effectively macOS-only.

## Standards, Comments, and Types

- No repository-wide formatter/linter configuration or CI enforcement exists. Rustfmt defaults and TypeScript strict mode are configured, but not run by `make test`; Swift has no enforced formatter/linter.
- `tsconfig.json` uses `strict: true`, yet `tsc --noEmit` currently fails in source and tests. Errors include AI SDK event drift, missing raw-module declarations, inconsistent template boolean values, incomplete category fixtures, and generic mock mismatch.
- Production TypeScript still uses isolated `any` values in bridge/UI integration. Native client interfaces are a positive model for gradual replacement.
- Public Rust functions have some doc comments, but exported `extern "C"` unsafe boundaries lack formal safety/ownership documentation beyond return comments.
- Swift public parser types are readable; large UI/process classes need more responsibility-level documentation, not line-by-line comments.
- JavaScript HTML escaping has multiple local implementations. `snippet-rendering.ts` is a good shared primitive, but not universally used.
- No ESLint, Clippy-as-error, shellcheck, Markdown lint, dependency license audit, or secret scan is automated.
- Tests cover unit and jsdom integration levels. There is no end-to-end app launch, real WebView bridge, installer, upgrade, or release artifact test.
- Existing root README is primarily Chinese and overstates cross-platform readiness. Public API/package metadata lacks description, license, repository, and rust-version fields.

## Baseline Verification

| Command | Result on 2026-08-12 |
| --- | --- |
| `make test-core` | 74 tests: 69 passed, 5 failed. Four failures require a usable clipboard; one FFI save test uses shared default storage. |
| `make test-editor` | 23 files, 174 tests passed. |
| `corepack pnpm exec tsc --noEmit` | Failed with existing source/test type errors. |
| `make test-macos` | Could not execute in the managed environment because nested SwiftPM sandboxing was denied. Must be verified in a normal terminal and GitHub macOS runner. |
| Rust offline resolution in clean worktree | Failed because Cargo lockfiles are not tracked. |

## License Recommendation

Use the MIT License with:

```text
Copyright (c) 2026 Kimi Wu
```

MIT matches the project's intended low-friction adoption and is compatible with the identified MIT, Apache-2.0, BSD-style, Zlib, BSL-1.0, Unlicense, and MPL-2.0 dependency set. Apache-2.0 dependencies retain their notices and patent terms; MPL-covered dependency-file modifications retain MPL notices/source obligations; system framework and Linux binary redistribution obligations remain separately applicable.

Before distributing binaries, generate a third-party notices/license bundle from the actual locked release graph. MIT licensing this repository does not change third-party licenses or grant rights to provider trademarks, Apple SDKs, or hosted AI services.

## Recommended Direction

1. Complete P0 release governance, lockfiles, deterministic tests, strict type checking, macOS Universal 2 packaging, and CI.
2. Treat API-key storage and native snippet-wheel HTML injection as focused security follow-ups before calling the AI/import experience hardened.
3. Keep Windows/Linux experimental until each has a lockfile, native runner, integration tests, and installable artifact.
4. Decompose large editor and Swift UI files only alongside behavior changes; a broad rewrite would add risk without improving this release milestone.
