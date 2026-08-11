# Streaming Workflow Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render only complete AI-generated workflow stages during streaming while retaining strict final validation before a workflow can be saved.

**Architecture:** Add a pure parser that extracts complete stage objects from the top-level `stages` array without parsing unfinished JSON. The orchestration UI will use it only to update a non-persistable preview while text arrives, then replace the preview with the existing strict full-document parse at stream completion.

**Tech Stack:** TypeScript, Vitest, jsdom, CodeMirror 6.

---

## File Structure

- Modify: `editor/src/prompt-orchestration.ts` - extract complete JSON stage objects safely from a streaming response buffer.
- Modify: `editor/src/__tests__/prompt-orchestration.test.ts` - unit-test complete-stage extraction over partial JSON.
- Modify: `editor/src/prompt-orchestration-ui.ts` - render stream previews and keep Save disabled until final validation.
- Modify: `editor/src/__tests__/prompt-orchestration-ui.test.ts` - test progressive render and the final-save boundary.

### Task 1: Define Complete-Stage Extraction

**Files:**
- Modify: `editor/src/__tests__/prompt-orchestration.test.ts`
- Modify: `editor/src/prompt-orchestration.ts`

- [ ] **Step 1: Write failing parser tests**

Import `extractCompleteWorkflowStages` and add a test that splits this response immediately after the first stage, asserting the first partial buffer returns exactly one stage while the full response returns both stages:

```ts
const response = '{"stages":[{"prompts":[{"title":"Research","content":"Find sources"}]},{"prompts":[{"title":"Write","content":"Draft copy"}]}]}';
const firstChunk = response.slice(0, response.indexOf('},{"prompts"') + 1);

expect(extractCompleteWorkflowStages(firstChunk)).toEqual([
  { prompts: [{ title: 'Research', content: 'Find sources' }] },
]);
expect(extractCompleteWorkflowStages(response)).toHaveLength(2);
```

Add a separate test whose chunk ends within `"content":"Use \\"quoted\\" text"`; assert no incomplete stage is returned.

- [ ] **Step 2: Run the focused parser tests and verify failure**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration.test.ts`

Expected: FAIL because `extractCompleteWorkflowStages` does not exist.

- [ ] **Step 3: Implement the pure extractor**

Export `extractCompleteWorkflowStages(raw: string): unknown[]`. Find the `"stages"` property, locate its opening array, then scan one character at a time. Track `inString`, `escaping`, `arrayDepth`, and `objectDepth`; collect a stage slice only when its outer object closes at the first level of the stages array. Parse each closed slice with `JSON.parse`; ignore slices which fail parsing. Return collected values without normalizing or mutating them.

- [ ] **Step 4: Run the focused parser tests and verify success**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration.test.ts`

Expected: PASS.

### Task 2: Render Streamed Preview Safely

**Files:**
- Modify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`
- Modify: `editor/src/prompt-orchestration-ui.ts`

- [ ] **Step 1: Write the failing UI regression test**

Mock `streamAIText` to save its chunk and done callbacks. Send a partial response containing one complete stage and the start of a second stage. Assert one `.prompt-workflow-stage` renders and `#prompt-workflow-save` is disabled. Then deliver the remaining JSON and call done; assert both stages render and Save becomes enabled.

- [ ] **Step 2: Run the focused UI test and verify failure**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration-ui.test.ts`

Expected: FAIL because the current chunk callback only appends text and does not render.

- [ ] **Step 3: Implement preview state and rendering**

In `openWorkflowEditor`, add preview-only state for completed stages and render it from the chunk callback with a fallback title. Normalize preview data by passing a synthetic workflow object with the extracted stages through `normalizeWorkflow`; catch invalid preview data and leave the current preview unchanged. Keep Save disabled while `generationComplete` is false. In the done callback, set `generationComplete` true only after `parseWorkflowResponse(accumulated, sourcePrompt)` succeeds, then render the final workflow.

- [ ] **Step 4: Run the focused UI test and verify success**

Run: `pnpm --dir editor exec vitest run src/__tests__/prompt-orchestration-ui.test.ts`

Expected: PASS.

### Task 3: Verify The Integrated Editor

**Files:**
- Verify: `editor/src/prompt-orchestration.ts`
- Verify: `editor/src/prompt-orchestration-ui.ts`
- Verify: `editor/src/__tests__/prompt-orchestration.test.ts`
- Verify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`

- [ ] **Step 1: Run all editor tests**

Run: `pnpm --dir editor test`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Build the production editor bundle**

Run: `pnpm --dir editor build`

Expected: Vite exits with code 0.

- [ ] **Step 3: Deploy the verified editor bundle to the local macOS app**

Run: `./quick-update.sh`

Expected: the script rebuilds the editor, replaces `build/PromptEditor.app/Contents/Resources/editor.html`, and relaunches the app.

- [ ] **Step 4: Review the scoped diff**

Run: `git diff --check && git diff -- editor/src/prompt-orchestration.ts editor/src/prompt-orchestration-ui.ts editor/src/__tests__/prompt-orchestration.test.ts editor/src/__tests__/prompt-orchestration-ui.test.ts`

Expected: no whitespace errors; only the planned parser, preview behavior, and regression tests changed.
