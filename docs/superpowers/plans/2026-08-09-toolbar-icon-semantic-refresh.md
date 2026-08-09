# Toolbar Icon Semantic Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every top-toolbar icon with a consistent, semantically accurate outline SVG while preserving the Send icon for Paste to Last Position.

**Architecture:** Keep all icons inline in `editor/index.html`, following the existing single-file toolbar structure and adding stable `data-icon` markers for testability. A focused jsdom test imports the raw HTML and verifies the complete icon mapping, accessible names, and shared SVG presentation contract without adding runtime dependencies.

**Tech Stack:** HTML, inline SVG, CSS, TypeScript, Vitest, jsdom, Vite

---

## File Structure

- Create `editor/src/__tests__/toolbar-icons.test.ts`: owns the static toolbar icon mapping and accessibility contract.
- Modify `editor/index.html`: owns toolbar button markup, accessible labels, and inline SVG geometry.

### Task 1: Lock the Toolbar Icon Contract

**Files:**
- Create: `editor/src/__tests__/toolbar-icons.test.ts`
- Test: `editor/src/__tests__/toolbar-icons.test.ts`

- [ ] **Step 1: Write the failing mapping and accessibility test**

Create `editor/src/__tests__/toolbar-icons.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import editorHTML from '../../index.html?raw';

const toolbarIcons = {
  'btn-workspace': ['folder-open', 'Set Workspace'],
  'btn-history': ['history', 'History'],
  'btn-prompt-memory': ['scan-search', 'Scan Prompt Memory'],
  'btn-snippets': ['blocks', 'Prompt Snippets'],
  'btn-templates': ['layout-template', 'Templates'],
  'btn-template-mode': ['file-pen-line', 'Template Edit Mode'],
  'btn-files': ['file-symlink', 'File References'],
  'btn-ai-enhance': ['wand-sparkles', 'AI Enhance Prompt'],
  'btn-ai-settings': ['sliders-horizontal', 'AI Settings'],
  'btn-save': ['archive', 'Save to History'],
  'btn-copy': ['copy', 'Copy to Clipboard'],
  'btn-clear': ['eraser', 'Clear Editor'],
  'btn-paste-previous': ['send', 'Paste to Last Position'],
} as const;

describe('top toolbar icons', () => {
  const page = new DOMParser().parseFromString(editorHTML, 'text/html');

  it.each(Object.entries(toolbarIcons))('maps %s to a semantic icon', (buttonId, [icon, label]) => {
    const button = page.querySelector<HTMLButtonElement>(`#${buttonId}`);
    const svg = button?.querySelector('svg');

    expect(button?.dataset.icon).toBe(icon);
    expect(button?.getAttribute('aria-label')).toBe(label);
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
  });

  it('uses one outline presentation contract for every toolbar icon', () => {
    const svgs = page.querySelectorAll('#toolbar .actions > button.icon-btn-toolbar > svg');

    expect(svgs).toHaveLength(Object.keys(toolbarIcons).length);
    for (const svg of svgs) {
      expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(svg.getAttribute('fill')).toBe('none');
      expect(svg.getAttribute('stroke')).toBe('currentColor');
      expect(svg.getAttribute('stroke-width')).toBe('2');
      expect(svg.getAttribute('stroke-linecap')).toBe('round');
      expect(svg.getAttribute('stroke-linejoin')).toBe('round');
    }
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd editor && npm test -- src/__tests__/toolbar-icons.test.ts`

Expected: FAIL because the current toolbar buttons have no `data-icon` markers and most lack explicit accessible names and outline SVG attributes.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add editor/src/__tests__/toolbar-icons.test.ts
git commit -m "test: define toolbar icon semantics"
```

### Task 2: Replace the Top Toolbar SVGs

**Files:**
- Modify: `editor/index.html:53-60`
- Modify: `editor/index.html:3993-4036`
- Test: `editor/src/__tests__/toolbar-icons.test.ts`

- [ ] **Step 1: Change the shared SVG CSS from fill icons to outline icons**

Replace the current SVG rule with:

```css
#toolbar button.icon-btn-toolbar svg {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
}
```

This removes the inherited `fill: currentColor` declaration; every SVG will declare its own shared outline attributes.

- [ ] **Step 2: Add stable icon names and accessible labels to all toolbar buttons**

Use these exact button attributes while retaining every existing class and `title`:

```html
data-icon="folder-open" aria-label="Set Workspace"
data-icon="history" aria-label="History"
data-icon="scan-search" aria-label="Scan Prompt Memory"
data-icon="blocks" aria-label="Prompt Snippets"
data-icon="layout-template" aria-label="Templates"
data-icon="file-pen-line" aria-label="Template Edit Mode"
data-icon="file-symlink" aria-label="File References"
data-icon="wand-sparkles" aria-label="AI Enhance Prompt"
data-icon="sliders-horizontal" aria-label="AI Settings"
data-icon="archive" aria-label="Save to History"
data-icon="copy" aria-label="Copy to Clipboard"
data-icon="eraser" aria-label="Clear Editor"
data-icon="send" aria-label="Paste to Last Position"
```

- [ ] **Step 3: Replace each old filled path with the selected outline SVG**

Every toolbar SVG must start with this common element:

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
```

Use the following child geometry, in toolbar order:

```html
<!-- FolderOpen -->
<path d="M6 14h6"/><path d="m13 4-2-2H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-5.5"/><path d="M16 13H9"/><path d="m12 10-3 3 3 3"/>

<!-- History -->
<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>

<!-- ScanSearch -->
<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="11" cy="11" r="3"/><path d="m16 16-2.5-2.5"/>

<!-- Blocks -->
<rect width="7" height="7" x="14" y="3" rx="1"/><path d="M10 21V8a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1H3"/>

<!-- LayoutTemplate -->
<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>

<!-- FilePenLine -->
<path d="M12 22h6a2 2 0 0 0 2-2v-7"/><path d="M16.5 2.5a2.121 2.121 0 0 1 3 3L12 13l-4 1 1-4Z"/><path d="m15 4 3 3"/><path d="M4 13V4a2 2 0 0 1 2-2h7"/><path d="M4 18h4"/>

<!-- FileSymlink -->
<path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 2H6a2 2 0 0 0-2 2v3"/><path d="M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/>

<!-- WandSparkles -->
<path d="m15 4-1-2-1 2-2 1 2 1 1 2 1-2 2-1-2-1Z"/><path d="m19 10-1-2-1 2-2 1 2 1 1 2 1-2 2-1-2-1Z"/><path d="m5 20 9-9"/><path d="m6.5 8.5-3 3a2.121 2.121 0 0 0 3 3l3-3"/><path d="m4 17 3 3"/>

<!-- SlidersHorizontal -->
<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>

<!-- Archive -->
<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>

<!-- Copy -->
<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>

<!-- Eraser -->
<path d="m7 21-4.3-4.3c-.9-.9-.9-2.3 0-3.2l9.8-9.8c.9-.9 2.3-.9 3.2 0l4.6 4.6c.9.9.9 2.3 0 3.2L11 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>

<!-- Send; intentionally retained for Paste to Last Position -->
<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `cd editor && npm test -- src/__tests__/toolbar-icons.test.ts`

Expected: PASS with 14 tests: 13 semantic mappings plus one shared SVG presentation contract.

- [ ] **Step 5: Commit the implementation**

```bash
git add editor/index.html
git commit -m "feat: align toolbar icons with actions"
```

### Task 3: Regression and Visual Verification

**Files:**
- Verify: `editor/index.html`
- Verify: `editor/src/__tests__/toolbar-icons.test.ts`

- [ ] **Step 1: Run the complete editor test suite**

Run: `cd editor && npm test`

Expected: all Vitest files and tests pass.

- [ ] **Step 2: Run the production build**

Run: `cd editor && npm run build`

Expected: Vite exits with code 0 and emits the single-file production build to `editor/dist`.

- [ ] **Step 3: Check the patch for whitespace and scope**

Run: `git diff --check HEAD~2..HEAD`

Expected: no output.

Run: `git status --short`

Expected: no uncommitted implementation files; any unrelated pre-existing user files remain untouched.

- [ ] **Step 4: Inspect the toolbar in the browser**

Run: `cd editor && npm run dev -- --host 127.0.0.1`

Open the reported local URL and capture desktop and narrow screenshots. Confirm all 13 icons render as nonblank 16px outline glyphs, buttons remain 32px or wider and 28px high, no toolbar item overlaps, Prompt Snippets visibly uses Blocks, and Paste to Last Position visibly uses Send. Repeat in light and dark color schemes.

- [ ] **Step 5: Record final repository state**

Run: `git log -3 --oneline`

Expected: the design commit, contract-test commit, and implementation commit appear in order, with no unrelated files included.
