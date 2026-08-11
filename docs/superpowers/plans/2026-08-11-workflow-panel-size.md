# Workflow Panel Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the desktop Prompt orchestration panel while preserving the mobile viewport-safe layout.

**Architecture:** Update only the existing modal CSS constraint in `editor/index.html`. The internal editor scrolling and mobile media override remain unchanged.

**Tech Stack:** HTML/CSS, Vitest, Vite.

---

### Task 1: Expand The Desktop Panel Constraint

**Files:**
- Modify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`
- Modify: `editor/index.html`

- [ ] **Step 1: Write the failing CSS contract test**

Add a test which reads `editor/index.html` and asserts it contains:

```ts
expect(html).toContain('width: min(1360px, 96vw); height: min(900px, 92vh);');
expect(html).toContain('.prompt-workflow-modal { width: 100%; height: 94vh; }');
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration-ui.test.ts`

Expected: FAIL because the desktop constraint remains `1080px` by `780px`.

- [ ] **Step 3: Update the modal dimensions**

In `editor/index.html`, replace:

```css
width: min(1080px, 94vw); height: min(780px, 88vh);
```

with:

```css
width: min(1360px, 96vw); height: min(900px, 92vh);
```

Do not alter the existing mobile rule, overlay padding, or internal scroll behavior.

- [ ] **Step 4: Run the focused test and verify success**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration-ui.test.ts`

Expected: PASS.

### Task 2: Verify And Deploy

**Files:**
- Verify: `editor/index.html`
- Verify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`

- [ ] **Step 1: Run all editor tests**

Run: `pnpm --dir editor test`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Build the editor bundle**

Run: `pnpm --dir editor build`

Expected: Vite exits with code 0.

- [ ] **Step 3: Update the local macOS app**

Run: `./quick-update.sh`

Expected: the latest `editor.html` is copied into `build/PromptEditor.app` and the app relaunches.

- [ ] **Step 4: Review the scoped diff**

Run: `git diff --check && git diff -- editor/index.html editor/src/__tests__/prompt-orchestration-ui.test.ts`

Expected: no whitespace errors; only the size constraint and CSS contract test changed.
