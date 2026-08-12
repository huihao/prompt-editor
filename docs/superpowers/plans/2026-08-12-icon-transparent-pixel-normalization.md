# Icon Transparent Pixel Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure fully transparent pixels in every generated raster icon have zeroed RGB channels without changing visible or partially transparent pixels.

**Architecture:** Add one dependency-free Swift/ImageIO utility with `normalize` and `check` operations. Integrate normalization into the existing generator before container assembly, and make the existing validator audit every generated transparent PNG.

**Tech Stack:** Swift, CoreGraphics, ImageIO, POSIX shell, `sips`, `iconutil`, existing icon scripts.

---

## File Map

- `scripts/normalize-transparent-pixels.swift`: decode PNGs into RGBA, normalize alpha-zero pixels, atomically rewrite, and audit contamination.
- `scripts/generate-icons.sh`: normalize all PNG outputs before ICNS/ICO assembly.
- `scripts/validate-icons.sh`: audit transparent RGB data in every generated transparent PNG.
- Generated icon files: deterministic outputs refreshed by the generator.

### Task 1: Add the Transparent-Pixel Utility

**Files:**
- Create: `scripts/normalize-transparent-pixels.swift`

- [ ] **Step 1: Create a failing alpha-contamination fixture**

Use Swift/CoreGraphics to create a 2x1 PNG whose first pixel is `(255, 255, 255, 0)` and second pixel is `(10, 20, 30, 128)` under a temporary directory.

- [ ] **Step 2: Verify the missing checker fails**

Run:

```bash
swift scripts/normalize-transparent-pixels.swift check "$fixture"
```

Expected: failure because the utility does not exist yet.

- [ ] **Step 3: Implement `check` and `normalize`**

Decode through `CGImageSource`, render to a known RGBA byte buffer, count pixels with alpha zero and nonzero RGB, and fail `check` when the count is nonzero. For `normalize`, zero RGB only for alpha-zero pixels and write with `CGImageDestination` to a sibling temporary file before replacement.

- [ ] **Step 4: Verify semantics and idempotency**

Run `check` before normalization, `normalize`, then `check` again. Hash the normalized file before and after a second normalization and require identical SHA-256 values. Confirm the partial-alpha pixel remains `(10, 20, 30, 128)`.

### Task 2: Integrate Generation and Validation

**Files:**
- Modify: `scripts/generate-icons.sh`
- Modify: `scripts/validate-icons.sh`
- Modify: generated PNG/ICNS/ICO assets as produced by the script

- [ ] **Step 1: Add a reusable normalization call**

After `sips` writes each PNG, run:

```bash
swift "$REPO_DIR/scripts/normalize-transparent-pixels.swift" normalize "$output"
```

Normalize the 1024 master and resized outputs before `iconutil` and ICO builders consume them.

- [ ] **Step 2: Audit all transparent PNG outputs**

Add every generated Linux, Windows, macOS, and website PNG to the validation loop and run:

```bash
swift "$REPO_DIR/scripts/normalize-transparent-pixels.swift" check "$image"
```

- [ ] **Step 3: Regenerate and validate assets**

Run:

```bash
./scripts/generate-icons.sh
./scripts/validate-icons.sh
```

Expected: both commands exit zero, all dimensions and container representations remain present, and no transparent RGB contamination is reported.

- [ ] **Step 4: Verify application packaging**

Run:

```bash
make macos
test -s build/PromptEditor.app/Contents/Resources/PromptEditor.icns
lipo build/PromptEditor.app/Contents/MacOS/PromptEditor -verify_arch arm64 x86_64
```

Expected: Universal 2 application bundle contains the regenerated icon.

- [ ] **Step 5: Commit**

```bash
git add scripts assets macos windows linux website
git commit -m "fix: normalize transparent icon pixels"
```

### Task 3: Final Verification

- [ ] **Step 1: Run icon and repository checks**

```bash
./scripts/validate-icons.sh
make verify
git diff --check
git status --short
```

Expected: icon validation and all repository tests pass; only the user's pre-existing `.pnpm-store/` remains untracked.
