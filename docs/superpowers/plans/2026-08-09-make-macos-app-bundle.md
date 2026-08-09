# `make macos` App Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `make macos` compile the frontend and produce a complete macOS application bundle with the latest editor resource.

**Architecture:** Extend the existing Make target rather than introduce a second packaging script. Reuse the `editor` and `core-universal` prerequisites, then perform Swift compilation and deterministic bundle assembly in the `macos` recipe.

**Tech Stack:** GNU Make, Vite, Cargo, Swift Package Manager, macOS app bundle layout

---

### Task 1: Define and implement complete macOS packaging

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Run the failing behavior check**

Run:

```bash
make -n macos | tee /tmp/prompt-editor-make-macos.txt
rg "vite build" /tmp/prompt-editor-make-macos.txt
rg "Resources/editor.html" /tmp/prompt-editor-make-macos.txt
```

Expected: both searches fail because the current target neither builds the frontend nor packages it.

- [ ] **Step 2: Implement the minimal target change**

Change `macos` to depend on `core-universal editor`. In its recipe, copy the Rust library and header, run the release Swift build, recreate `build/PromptEditor.app`, and copy the executable, plist, and `editor/dist/index.html` into their standard bundle paths.

- [ ] **Step 3: Verify the target graph**

Run:

```bash
make -n macos | rg "vite build|Resources/editor.html"
```

Expected: output contains the Vite build command and the command that copies `editor/dist/index.html` to `Contents/Resources/editor.html`.

- [ ] **Step 4: Build and inspect the real bundle**

Run:

```bash
make macos
test -x build/PromptEditor.app/Contents/MacOS/PromptEditor
test -f build/PromptEditor.app/Contents/Info.plist
test -f build/PromptEditor.app/Contents/Resources/editor.html
```

Expected: `make macos` exits successfully and all three bundle assertions pass.

- [ ] **Step 5: Review the patch**

Run:

```bash
git diff --check
git diff -- Makefile
```

Expected: no whitespace errors and only the intended macOS target changes appear.
