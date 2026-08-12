# Icon Transparent Pixel Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure every pixel outside the icon's rounded silhouette is fully transparent without changing internal translucent artwork or antialiased edges.

**Architecture:** Clip all SVG artwork to the existing rounded silhouette at the canonical vector source. Extend the existing Swift image inspector and shell validator to audit corner alpha, then regenerate all platform assets.

**Tech Stack:** Swift, CoreGraphics, ImageIO, POSIX shell, `sips`, `iconutil`, existing icon scripts.

---

## File Map

- `assets/branding/prompt-forge.svg`: clip every visible layer to the rounded icon silhouette.
- `scripts/inspect-image.swift`: expose corner alpha values for raster validation.
- `scripts/validate-icons.sh`: require fully transparent corners in generated PNGs.
- Generated icon files: deterministic outputs refreshed by the generator.

### Task 1: Add the Transparent-Corner Audit

**Files:**
- Modify: `scripts/inspect-image.swift`

- [ ] **Step 1: Verify the current master fails**

Run the new corner-alpha mode against the current generated master.

- [ ] **Step 2: Verify the missing checker fails**

Run:

```bash
swift scripts/inspect-image.swift --corner-alpha assets/branding/prompt-forge-1024.png
```

Expected before implementation: the command is unsupported; after adding inspection but before clipping, at least one corner alpha is nonzero.

- [ ] **Step 2: Implement corner-alpha inspection**

Decode through `CGImageSource`, render to a known RGBA buffer, and print alpha values at all four canvas corners.

- [ ] **Step 3: Add the failing shell validation**

Update `scripts/validate-icons.sh` to require `corner-alpha=0,0,0,0`, then run it against the current master and confirm it fails.

### Task 2: Clip and Regenerate Artwork

**Files:**
- Modify: `assets/branding/prompt-forge.svg`
- Modify: generated PNG/ICNS/ICO assets as produced by the script

- [ ] **Step 1: Add the shared rounded clip**

Define the clip in `defs` and wrap all visible artwork:

```bash
<clipPath id="iconMask"><rect width="1024" height="1024" rx="224"/></clipPath>
<g clip-path="url(#iconMask)">...</g>
```

- [ ] **Step 2: Regenerate and validate assets**

Run:

```bash
./scripts/generate-icons.sh
./scripts/validate-icons.sh
```

Expected: both commands exit zero, all dimensions and container representations remain present, and every generated PNG reports four fully transparent corners.

- [ ] **Step 3: Verify application packaging**

Run:

```bash
make macos
test -s build/PromptEditor.app/Contents/Resources/PromptEditor.icns
lipo build/PromptEditor.app/Contents/MacOS/PromptEditor -verify_arch arm64 x86_64
```

Expected: Universal 2 application bundle contains the regenerated icon.

- [ ] **Step 4: Commit**

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
