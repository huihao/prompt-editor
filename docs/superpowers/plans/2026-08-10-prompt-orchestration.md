# Prompt Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered workflow generator that expands the current prompt into editable sequential stages and parallel prompt groups, then saves and manages workflows independently from the editor draft.

**Architecture:** Keep generation, normalization, Markdown export, storage, and DOM interaction in focused modules. Reuse `streamAIText` and the existing AI settings. A workflow is an ordered array of stages; prompts in one stage are parallel, while stages are sequential. The UI is a modal generator/editor plus a separate saved-workflow manager and never replaces the current CodeMirror document.

**Tech Stack:** TypeScript, Vite, Vitest/jsdom, existing CodeMirror editor, browser `localStorage`, existing Vercel AI SDK wrapper.

---

### Task 1: Define and normalize workflow data

**Files:**
- Create: `editor/src/prompt-orchestration.ts`
- Test: `editor/src/__tests__/prompt-orchestration.test.ts`

- [ ] **Step 1: Write failing tests for parsing and normalization**

Add tests for `parseWorkflowResponse` covering plain JSON, fenced JSON, missing title/step titles, empty stages/steps, non-object JSON, and a maximum step limit. Assert normalized output has generated IDs, non-empty titles/content, and no empty stages.

```ts
it('strips a markdown fence and normalizes generated workflow data', () => {
  const workflow = parseWorkflowResponse('```json\n{"title":"Research","stages":[{"prompts":[{"content":"Find sources"}]}]}\n```', 'original');
  expect(workflow.title).toBe('Research');
  expect(workflow.sourcePrompt).toBe('original');
  expect(workflow.stages[0].prompts[0].title).toBe('Step 1');
  expect(workflow.stages[0].prompts[0].id).toEqual(expect.any(String));
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run `cd editor && pnpm test -- src/__tests__/prompt-orchestration.test.ts`. Expected: FAIL because the parser module and function do not exist.

- [ ] **Step 3: Implement the core types and normalization**

Define `PromptWorkflow`, `PromptStage`, and `WorkflowPrompt`. Export `parseWorkflowResponse(raw, sourcePrompt)`, `normalizeWorkflow(input, sourcePrompt)`, `stripJsonFence(raw)`, and `workflowToMarkdown(workflow)`. Parse the first JSON object after removing an optional code fence; default the title to `Untitled workflow`, stage titles are represented by position, and step titles default to `Step N`. Trim content, discard empty items, cap total prompts at 24, and generate IDs with timestamp plus random suffix. `workflowToMarkdown` must label stages and append `(parallel)` when a stage has more than one prompt.

- [ ] **Step 4: Run focused tests and the full editor suite**

Run `cd editor && pnpm test -- src/__tests__/prompt-orchestration.test.ts` and then `cd editor && pnpm test`. Expected: all tests PASS.

- [ ] **Step 5: Commit the core module**

```bash
git add editor/src/prompt-orchestration.ts editor/src/__tests__/prompt-orchestration.test.ts
git commit -m "feat: add prompt workflow normalization"
```

### Task 2: Add persistent workflow store

**Files:**
- Create: `editor/src/prompt-workflow-store.ts`
- Test: `editor/src/__tests__/prompt-workflow-store.test.ts`

- [ ] **Step 1: Write failing store tests**

Use jsdom `localStorage` and test `list`, `save`, `get`, `rename`, `delete`, `duplicate`, and recovery from malformed JSON. Assert saving updates `updatedAt`, duplicate creates a new ID, and the original workflow remains unchanged.

- [ ] **Step 2: Run the focused test and verify it fails**

Run `cd editor && pnpm test -- src/__tests__/prompt-workflow-store.test.ts`. Expected: FAIL because the store does not exist.

- [ ] **Step 3: Implement `PromptWorkflowStore`**

Use storage key `promptEditor:workflows:v1`. Read an array defensively; return `[]` for malformed or incompatible data. Expose synchronous methods `list(): PromptWorkflow[]`, `get(id)`, `save(workflow)`, `rename(id, title)`, `duplicate(id)`, and `delete(id)`. Clone values at boundaries with JSON serialization so callers cannot mutate stored state. Preserve `sourcePrompt`, `createdAt`, and stage order; `save` assigns timestamps and replaces by ID.

- [ ] **Step 4: Run focused and full tests**

Run `cd editor && pnpm test -- src/__tests__/prompt-workflow-store.test.ts` and `cd editor && pnpm test`. Expected: PASS.

- [ ] **Step 5: Commit storage**

```bash
git add editor/src/prompt-workflow-store.ts editor/src/__tests__/prompt-workflow-store.test.ts
git commit -m "feat: persist prompt workflows locally"
```

### Task 3: Build generation and workflow editor UI

**Files:**
- Create: `editor/src/prompt-orchestration-ui.ts`
- Test: `editor/src/__tests__/prompt-orchestration-ui.test.ts`
- Modify: `editor/src/editor.ts`
- Modify: `editor/index.html`

- [ ] **Step 1: Write failing UI behavior tests**

Test exported `showPromptOrchestration(view)` with mocked `streamAIText` and `isAIConfigured`: empty input shows a toast and no modal; configured input opens the modal and renders the original text; a streamed valid JSON result renders stage/step fields; save calls the store and leaves the CodeMirror document unchanged; cancel aborts and removes the modal.

- [ ] **Step 2: Run focused UI tests and verify failure**

Run `cd editor && pnpm test -- src/__tests__/prompt-orchestration-ui.test.ts`. Expected: FAIL because the UI module and toolbar entry do not exist.

- [ ] **Step 3: Implement modal generation flow**

Create `showPromptOrchestration(view)` and `showWorkflowManager(view)`. Select the CodeMirror selection when non-empty, otherwise the full document. Require `isAIConfigured`; otherwise call `showSettings('ai')`. Generate with a dedicated system prompt requesting only the documented JSON schema, accumulate streaming chunks, parse with `parseWorkflowResponse`, and show retry/cancel/error states. Keep an `AbortController` and ensure closing the modal aborts an active request.

- [ ] **Step 4: Implement editable stage list**

Render a modal with title input, ordered stage sections, and prompt cards. Use event delegation for input/change/click actions. Provide buttons for add stage, add prompt, duplicate/delete prompt, delete stage, move stage up/down, and move a prompt to the previous/next stage. Use native drag-and-drop for stage and prompt movement; every mutation updates the in-memory workflow and rerenders only the list region. Disable Save when there are no valid prompts.

- [ ] **Step 5: Add saved-workflow manager**

Render stored workflows with title, updated time, and actions to open, rename, duplicate, copy Markdown, and delete after `window.confirm`. Saving from the editor calls `PromptWorkflowStore.save` and closes the editor modal without dispatching changes to CodeMirror.

- [ ] **Step 6: Wire toolbar and styles**

In `editor/index.html`, add `btn-ai-orchestrate` beside `btn-ai-enhance` and `btn-workflows` near the toolbar actions, with existing icon-button conventions and accessible title/aria-label. Add responsive modal, stage, parallel-group, prompt-card, manager, loading, and error styles using existing CSS variables and dark-mode media rules. In `editor.ts`, import the UI functions, pass the initialized `view`, and wire both buttons. Add keyboard handling for Escape and keep focus on the editor after close.

- [ ] **Step 7: Run UI tests and build**

Run `cd editor && pnpm test -- src/__tests__/prompt-orchestration-ui.test.ts` then `cd editor && pnpm build`. Expected: tests PASS and Vite build completes without TypeScript errors.

- [ ] **Step 8: Commit UI integration**

```bash
git add editor/src/prompt-orchestration-ui.ts editor/src/__tests__/prompt-orchestration-ui.test.ts editor/src/editor.ts editor/index.html
git commit -m "feat: add prompt orchestration editor"
```

### Task 4: Add integration regression coverage and final verification

**Files:**
- Modify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`
- Modify: `editor/src/__tests__/prompt-orchestration.test.ts`

- [ ] **Step 1: Add regression cases**

Cover AI not configured opening settings, stream errors preserving the original document, malformed model output allowing retry, parallel Markdown export, and manager delete/duplicate actions. Assert no workflow is persisted until Save is clicked.

- [ ] **Step 2: Run the complete verification set**

Run `cd editor && pnpm test`, `cd editor && pnpm build`, and `git diff --check`. Expected: all tests PASS, build succeeds, and diff check has no output.

- [ ] **Step 3: Inspect the final worktree**

Run `git status --short` and verify only the intended orchestration files plus the implementation plan are new/modified; preserve unrelated existing user changes.

- [ ] **Step 4: Commit regression coverage**

```bash
git add editor/src/__tests__/prompt-orchestration.test.ts editor/src/__tests__/prompt-orchestration-ui.test.ts
git commit -m "test: cover prompt orchestration flows"
```
