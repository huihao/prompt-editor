# Explicit AI Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require users to explicitly start AI enhancement and workflow orchestration after their panels open.

**Architecture:** Keep the existing streaming services unchanged. Initialize each panel in a ready state and move the existing stream invocation behind its user-facing generation button; reuse that action as Regenerate after a request completes or fails.

**Tech Stack:** TypeScript, Vitest, jsdom, CodeMirror 6, Vite.

---

### Task 1: Make Prompt Enhance Explicit

**Files:**
- Modify: `editor/src/__tests__/ai-features.test.ts`
- Modify: `editor/src/ai-enhance.ts`

- [ ] **Step 1: Write the failing enhance interaction test**

Open `enhancePrompt`, assert `streamAITextMock` has not been called and `#ai-enhance-generate` has the text `Enhance`. Click it, then assert the mock was called and Apply can update the selected text.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --dir editor exec vitest run src/__tests__/ai-features.test.ts`

Expected: FAIL because opening the panel immediately invokes the stream and no `#ai-enhance-generate` exists.

- [ ] **Step 3: Implement the enhance ready state**

Add `#ai-enhance-generate` with initial label `Enhance`, initial status `Ready`, and hidden cursor. Remove the automatic `startGeneration()` call. Start generation only from the new button click; change its label to `Regenerate` after successful or failed completion.

- [ ] **Step 4: Run the focused test and verify success**

Run: `pnpm --dir editor exec vitest run src/__tests__/ai-features.test.ts`

Expected: PASS.

### Task 2: Make Prompt Orchestration Explicit

**Files:**
- Modify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`
- Modify: `editor/src/prompt-orchestration-ui.ts`

- [ ] **Step 1: Write the failing orchestration interaction test**

Open `showPromptOrchestration`, assert `streamAITextMock` has not been called, the status contains `Ready to generate workflow.`, and `#prompt-workflow-regenerate` reads `Generate workflow`. Click it and assert the mock is called.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration-ui.test.ts`

Expected: FAIL because opening the editor currently calls `startGeneration()`.

- [ ] **Step 3: Implement the orchestration ready state**

For a new workflow, do not call `startGeneration` at panel creation. Show the ready status and set the existing generation action label to `Generate workflow`. In `startGeneration`, set the label to `Regenerate` once invoked. Leave saved workflow opening behavior unchanged.

- [ ] **Step 4: Run the focused test and verify success**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration-ui.test.ts`

Expected: PASS.

### Task 3: Verify And Deploy

**Files:**
- Verify: `editor/src/ai-enhance.ts`
- Verify: `editor/src/prompt-orchestration-ui.ts`
- Verify: their associated tests

- [ ] **Step 1: Run all editor tests**

Run: `pnpm --dir editor test`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Build the editor**

Run: `pnpm --dir editor build`

Expected: Vite exits with code 0.

- [ ] **Step 3: Update the local macOS app**

Run: `./quick-update.sh`

Expected: the app bundle receives the rebuilt editor resource and relaunches.
