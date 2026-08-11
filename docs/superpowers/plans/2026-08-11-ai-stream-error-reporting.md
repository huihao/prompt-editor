# AI Stream Error Reporting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface AI provider errors embedded in a streamed response instead of showing the AI SDK's generic empty-output error.

**Architecture:** Keep `streamAIText` and its callers unchanged. Consume the AI SDK's complete event stream, pass `text-delta` events to the existing chunk callback, and pass stream error events through the existing normalized error path. Treat a completed stream containing neither text nor an error as a failed empty response.

**Tech Stack:** TypeScript, Vercel AI SDK 6, Vitest, Vite.

---

## File Structure

- Modify: `editor/src/ai-service.ts` - consume complete stream events and normalize stream errors.
- Modify: `editor/src/__tests__/ai-service.test.ts` - prove stream errors are reported and successful text streams retain current behavior.

### Task 1: Add Stream Error Regression Tests

**Files:**
- Modify: `editor/src/__tests__/ai-service.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the current fallback-only mock result with a `fullStream` async generator and add this test:

```ts
it('reports an error emitted by the complete stream', async () => {
  const providerError = new Error('Model is unavailable');
  streamTextMock.mockReturnValue({
    fullStream: (async function* () {
      yield { type: 'error', error: providerError };
    })(),
  });

  const onChunk = vi.fn();
  const onDone = vi.fn();
  const onError = vi.fn();

  streamAIText([{ role: 'user', content: 'hello' }], onChunk, onDone, onError, config);

  await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(providerError));
  expect(onChunk).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
});
```

Add a separate test whose `fullStream` emits `{ type: 'text-delta', text: 'enhanced prompt' }` and assert `onChunk` receives that text followed by `onDone`.

- [ ] **Step 2: Run the focused test file to verify failure**

Run: `pnpm --dir editor test -- ai-service.test.ts`

Expected: FAIL because the current implementation reads `textStream`, which is absent from the new mock stream result.

### Task 2: Consume Full Stream Events

**Files:**
- Modify: `editor/src/ai-service.ts`

- [ ] **Step 1: Implement the minimal stream event handling**

Replace the `result.textStream` loop and `result.text` fallback with a `for await` loop over `result.fullStream`. Handle only these event types:

```ts
let sawText = false;
let streamError: Error | null = null;

for await (const part of result.fullStream) {
  if (abortController.signal.aborted) break;

  if (part.type === 'text-delta') {
    sawText = true;
    onChunk(part.text);
  } else if (part.type === 'error') {
    streamError = part.error instanceof Error ? part.error : new Error(String(part.error));
    break;
  }
}

if (streamError) throw streamError;
if (!abortController.signal.aborted && !sawText) {
  throw new Error('The AI provider returned an empty response. Try again or check the selected model.');
}
```

Leave the existing `onDone` call and `catch` block in place so cancellation and friendly HTTP/network errors continue to work.

- [ ] **Step 2: Run the focused test file to verify success**

Run: `pnpm --dir editor test -- ai-service.test.ts`

Expected: PASS with the new stream-error and text-delivery tests.

### Task 3: Verify Integration

**Files:**
- Verify: `editor/src/ai-service.ts`
- Verify: `editor/src/__tests__/ai-service.test.ts`

- [ ] **Step 1: Run the editor test suite**

Run: `pnpm --dir editor test`

Expected: PASS with zero failing tests.

- [ ] **Step 2: Build the production editor bundle**

Run: `pnpm --dir editor build`

Expected: Vite build completes with exit code 0.

- [ ] **Step 3: Review the scoped diff**

Run: `git diff --check && git diff -- editor/src/ai-service.ts editor/src/__tests__/ai-service.test.ts`

Expected: no whitespace errors; only the planned stream handling and regression tests changed.
