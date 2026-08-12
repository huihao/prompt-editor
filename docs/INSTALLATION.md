# Installation

## macOS Release (Recommended)

Prompt Editor supports macOS 12 or newer on Apple Silicon and Intel.

1. Download the versioned `.dmg` and `.dmg.sha256` from the GitHub Release.
2. Verify it from the download directory:

   ```bash
   shasum -a 256 -c PromptEditor-0.1.0-macos-universal.dmg.sha256
   ```

3. Open the disk image and drag **Prompt Editor** to **Applications**.
4. Launch Prompt Editor from Applications.

The `.tar.gz` contains the same Universal 2 app and is intended for automation. Extract it with `tar -xzf`, then move the app to `/Applications` or `~/Applications`.

## Build from Source

Install Xcode Command Line Tools, Rust 1.85 or newer, Node.js 20 or newer, and GNU Make:

```bash
xcode-select --install
rustup target add aarch64-apple-darwin x86_64-apple-darwin
corepack enable
corepack pnpm --dir editor install --frozen-lockfile
make test
make macos
open build/PromptEditor.app
```

Create local unsigned installation files with:

```bash
make package-macos VERSION=0.1.0
```

Artifacts are written to `build/release/`. Unsigned local builds are for development only.

## Permissions

Prompt Editor uses Accessibility permission to paste or send content to terminal applications. Grant it under **System Settings > Privacy & Security > Accessibility** when prompted, then restart the app. Removing this permission disables automation but does not prevent editing or copying.

Apple Events may be requested when interacting with terminal applications. The release uses hardened runtime signing and notarization when the maintainer credentials described in [RELEASING.md](RELEASING.md) are configured.

## Uninstall

Quit Prompt Editor, then remove it:

```bash
rm -rf "$HOME/Applications/PromptEditor.app"
```

For a system-wide install, remove `/Applications/PromptEditor.app` in Finder or with administrator approval. Remove Prompt Editor from Accessibility and Automation permissions in System Settings. Application data is intentionally retained; review and remove Prompt Editor-related data under `~/Library/Application Support/` only when you no longer need prompt history or settings.

## Troubleshooting

- **"App cannot be opened"**: use an official notarized release and verify its checksum. Do not bypass Gatekeeper for an untrusted download.
- **Intel build fails from source**: run `rustup target add x86_64-apple-darwin`.
- **Shortcut or send does not work**: enable Accessibility permission and restart the app.
- **SwiftPM cache errors in a restricted environment**: run the build from a normal Terminal session with access to `~/Library/Caches` and `~/.cache`.
- **Clipboard integration tests fail**: default tests do not require them; run `make test-clipboard` only in an interactive desktop session.

Windows and Linux shells are experimental and do not currently have supported installers.
