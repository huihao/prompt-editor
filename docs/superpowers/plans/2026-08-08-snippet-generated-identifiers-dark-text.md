# Generated Snippet Identifiers and Dark Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically generate immutable snippet/category identifiers and make all Prompt Snippet manager text readable on dark backgrounds.

**Architecture:** Add one pure identifier generator beside the manager UI and supply generated IDs as hidden form values during creation. Keep edit IDs disabled and visible. Add narrowly scoped dark-theme CSS overrides without changing DOM hierarchy or layout.

**Tech Stack:** TypeScript, DOM APIs, Vitest, jsdom, CSS, Vite

---

## File Map

- Modify `editor/src/snippet-manager-ui.ts`: generate identifiers, hide them on creation, preserve them through save, and generate fresh copy IDs.
- Modify `editor/src/__tests__/snippet-manager-ui.test.ts`: cover generated, hidden, immutable, and distinct identifiers.
- Modify `editor/index.html`: enforce light foreground and readable muted text in the dark manager.
- Modify `editor/src/__tests__/snippet-manager-ui.test.ts`: assert the dark-theme styling contract.

### Task 1: Generated Identifiers

**Files:**
- Modify: `editor/src/snippet-manager-ui.ts`
- Test: `editor/src/__tests__/snippet-manager-ui.test.ts`

- [ ] **Step 1: Write failing creation and copy tests**

Add tests that open the new snippet/category forms, assert no ID input is rendered, save valid forms, and inspect the stored IDs for `snippet-` / `category-` prefixes. Stub `crypto.randomUUID()` so the expected values are deterministic. Update the built-in copy test to expect a fresh generated ID.

- [ ] **Step 2: Run the focused UI tests and verify RED**

Run: `cd editor && pnpm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: failures because creation still renders editable ID fields and copied IDs derive from source IDs.

- [ ] **Step 3: Implement identifier generation and hidden creation values**

Add a pure exported helper:

```ts
export function generateIdentifier(prefix: 'snippet' | 'category'): string {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}
```

For new forms, render `<input type="hidden" id="snippet-id" ...>` or `<input type="hidden" id="category-id" ...>` with a generated value. For edit forms, continue rendering the disabled visible field. Focus the first user-editable field on creation. Copies use `generateIdentifier('snippet')`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `cd editor && pnpm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: all manager UI tests pass.

### Task 2: Dark Manager Text Contrast

**Files:**
- Modify: `editor/index.html`
- Test: `editor/src/__tests__/snippet-manager-ui.test.ts`

- [ ] **Step 1: Write a failing CSS contract test**

Read the raw HTML stylesheet and assert the dark color-scheme block scopes `.snippet-manager-modal` to a near-white foreground, applies a light foreground to form controls/buttons, and uses a readable muted placeholder/hint color.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd editor && pnpm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: failure because the dark manager does not explicitly define all foreground colors.

- [ ] **Step 3: Add dark-theme foreground overrides**

Within `@media (prefers-color-scheme: dark)`, add scoped rules for `.snippet-manager-modal`, its controls, buttons, placeholders, hints, paths, descriptions, badges, and close action. Use `#f5f5f7` for primary text and `#b8b8bd` for secondary text; retain existing error, success, focus, and primary button colors.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `cd editor && pnpm test -- src/__tests__/snippet-manager-ui.test.ts`

Expected: all manager UI tests pass.

### Task 3: Full Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run all tests**

Run: `cd editor && pnpm test`

Expected: all test files pass with zero failures.

- [ ] **Step 2: Build production output**

Run: `cd editor && pnpm build`

Expected: Vite exits successfully.

- [ ] **Step 3: Verify in the browser**

Open the manager in desktop and 390px-wide viewports. Confirm creation forms start at Name/Icon fields, IDs are absent, saved objects receive generated IDs, and all text remains readable against the dark modal.

- [ ] **Step 4: Check patch hygiene**

Run: `git diff --check`

Expected: no output and exit code 0.
