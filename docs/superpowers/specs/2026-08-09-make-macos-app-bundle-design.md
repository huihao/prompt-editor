# `make macos` App Bundle Design

## Goal

Make `make macos` produce a complete `build/PromptEditor.app` containing the latest frontend, instead of only compiling the Swift executable.

## Design

The existing `editor` target remains responsible for installing frontend dependencies and running Vite. The `macos` target will depend on both `core-universal` and `editor`, copy the generated Rust library and header into `macos/Libraries`, build the Swift release executable, and recreate the standard macOS application bundle under `build/PromptEditor.app`.

The bundle will contain:

- `Contents/MacOS/PromptEditor` from the Swift release build.
- `Contents/Info.plist` from `macos/PromptEditor/Info.plist`.
- `Contents/Resources/editor.html` from `editor/dist/index.html`.

Shell commands in the recipe will be joined so that a failed copy, build, or packaging operation fails the target immediately. Existing frontend source changes and other platform targets remain unchanged.

## Verification

First use a dry run to prove the current target does not invoke Vite or package `editor.html`. After the change, repeat the dry run and assert that both commands are present. Finally run `make macos` and inspect the application bundle for its executable, plist, and frontend resource.
