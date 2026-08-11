# AI Usage and Prompt Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track provider-reported AI token usage locally, display request and 30-day statistics, and maximize compatible prompt-cache use.

**Architecture:** `ai-usage.ts` owns private local records, retention, aggregations, and formatting. `ai-service.ts` captures the AI SDK finish usage, persists a successful labeled call, and returns the usage to the caller. The feature UI only renders returned per-request usage; settings renders aggregates. Stable feature instructions remain system-first; Anthropic receives an ephemeral cache breakpoint.

**Tech Stack:** TypeScript, Vercel AI SDK 6, Vitest, jsdom, localStorage, Vite.

---

## Task 1: Local Usage Module

**Files:**
- Create: `editor/src/ai-usage.ts`
- Create: `editor/src/__tests__/ai-usage.test.ts`

- [ ] **Step 1: Write failing storage tests**

```ts
it('records provider usage without prompt content and calculates cache hits', () => {
  recordAIUsage({ timestamp: Date.now(), feature: 'enhance', provider: 'openai', model: 'gpt-5.6', inputTokens: 100, outputTokens: 20, cacheReadTokens: 60 });
  expect(getAIUsageSummary()).toMatchObject({
    totals: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 60 },
    cacheHitRate: 0.6,
  });
  expect(JSON.stringify(localStorage)).not.toContain('prompt');
});

it('prunes records older than 30 days and clears records', () => {
  recordAIUsage({ timestamp: Date.now() - 31 * 86_400_000, feature: 'autocomplete', provider: 'openai', model: 'gpt-5.6' });
  recordAIUsage({ timestamp: Date.now(), feature: 'orchestration', provider: 'anthropic', model: 'claude-sonnet-5', inputTokens: 8 });
  expect(getAIUsageSummary().recordCount).toBe(1);
  clearAIUsage();
  expect(getAIUsageSummary().recordCount).toBe(0);
});
```

- [ ] **Step 2: Verify RED**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-usage.test.ts`. Expected: FAIL because `ai-usage.ts` does not exist.

- [ ] **Step 3: Implement minimal storage and summaries**

```ts
export type AIUsageFeature = 'enhance' | 'orchestration' | 'autocomplete';
export interface AIUsageRecord {
  timestamp: number; feature: AIUsageFeature; provider: string; model: string;
  inputTokens?: number; outputTokens?: number; cacheReadTokens?: number;
  cacheWriteTokens?: number; noCacheTokens?: number;
}
const STORAGE_KEY = 'promptEditor:aiUsage';
const RETENTION_MS = 30 * 86_400_000;
```

Implement `recordAIUsage`, `clearAIUsage`, `getAIUsageSummary`, `formatTokenCount`, and `formatUsageLine`. Prune on write. Aggregate values only when reported. Expose 30 UTC daily buckets, groups by feature and `provider/model`, and `cacheReadTokens / inputTokens` only when an input denominator exists.

- [ ] **Step 4: Verify GREEN and commit**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-usage.test.ts`. Expected: PASS. Commit `editor/src/ai-usage.ts` and its test with message `feat: track local AI token usage`.

## Task 2: Service Usage and Cache Control

**Files:**
- Modify: `editor/src/ai-service.ts`
- Modify: `editor/src/__tests__/ai-service.test.ts`

- [ ] **Step 1: Write failing stream tests**

```ts
it('records usage after a successful labeled stream', async () => {
  streamTextMock.mockReturnValue({ fullStream: (async function* () {
    yield { type: 'text-delta', text: 'result' };
    yield { type: 'finish', usage: { inputTokens: 40, outputTokens: 12, inputTokenDetails: { cacheReadTokens: 20 } } };
  })() });
  const onDone = vi.fn();
  streamAIText([{ role: 'user', content: 'hello' }], vi.fn(), onDone, vi.fn(), config, { feature: 'enhance' });
  await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 40, cacheReadTokens: 20 })));
  expect(recordAIUsageMock).toHaveBeenCalledWith(expect.objectContaining({ feature: 'enhance' }));
});

it('sets Anthropic cache control on the stable system prompt', () => {
  streamAIText([{ role: 'system', content: 'Stable' }, { role: 'user', content: 'Dynamic' }], vi.fn(), vi.fn(), vi.fn(), { ...config, provider: 'anthropic' });
  expect(streamTextMock).toHaveBeenCalledWith(expect.objectContaining({ system: expect.objectContaining({ providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } }) }));
});
```

Add error and aborted-stream tests that assert no record occurs.

- [ ] **Step 2: Verify RED**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-service.test.ts`. Expected: FAIL because request metadata and finish usage handling do not exist.

- [ ] **Step 3: Add typed usage flow**

```ts
export interface AIRequestOptions { feature?: AIUsageFeature; }
export interface AIRequestUsage {
  inputTokens?: number; outputTokens?: number; cacheReadTokens?: number;
  cacheWriteTokens?: number; noCacheTokens?: number;
}
```

Extend `streamAIText` with sixth positional `options?: AIRequestOptions` and change `onDone` to `(usage?: AIRequestUsage) => void`. Read each `finish` part’s usage, map SDK fields including `inputTokenDetails.cacheReadTokens`, and, after successful text completion, record only calls with `options.feature` before calling `onDone(usage)`. Test connection keeps no feature option. Use Anthropic’s ephemeral breakpoint only when a system instruction exists; leave other providers unchanged.

- [ ] **Step 4: Verify GREEN and commit**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-service.test.ts`. Expected: PASS. Commit both files with message `feat: capture AI usage and cache prompts`.

## Task 3: Feature Classification and Request Usage Lines

**Files:**
- Modify: `editor/src/ai-enhance.ts`
- Modify: `editor/src/prompt-orchestration-ui.ts`
- Modify: `editor/src/ai-autocomplete.ts`
- Modify: `editor/src/__tests__/ai-features.test.ts`
- Modify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`
- Modify: `editor/index.html`

- [ ] **Step 1: Write failing UI tests**

```ts
it('shows provider-reported usage after enhancing', () => {
  streamAITextMock.mockImplementation((_messages, onChunk, onDone) => {
    onChunk('better prompt');
    onDone({ inputTokens: 24, outputTokens: 18, cacheReadTokens: 12 });
    return new AbortController();
  });
  enhancePrompt(createView('draft'));
  document.querySelector<HTMLButtonElement>('#ai-enhance-generate')!.click();
  expect(document.querySelector('#ai-enhance-usage')?.textContent).toContain('24 input');
  expect(streamAITextMock.mock.calls[0][5]).toEqual({ feature: 'enhance' });
});
```

Add a valid workflow equivalent asserting `#prompt-workflow-usage` and `{ feature: 'orchestration' }`.

- [ ] **Step 2: Verify RED**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-features.test.ts src/__tests__/prompt-orchestration-ui.test.ts`. Expected: FAIL because usage elements and feature metadata do not exist.

- [ ] **Step 3: Implement classification and display**

Pass `{ feature: 'enhance' }`, `{ feature: 'orchestration' }`, and `{ feature: 'autocomplete' }` as sixth `streamAIText` arguments. Add initially hidden `#ai-enhance-usage` and `#prompt-workflow-usage`, populate with `formatUsageLine(usage)` only when values are reported, and clear them on regeneration. Autocomplete records data without a durable panel.

Add `.ai-usage-line { font-size: 11px; opacity: 0.7; white-space: nowrap; }` and `.ai-usage-line[hidden] { display: none; }` to `editor/index.html`, with a narrow-view wrapping rule.

- [ ] **Step 4: Verify GREEN and commit**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-features.test.ts src/__tests__/prompt-orchestration-ui.test.ts`. Expected: PASS. Commit relevant modules, tests, and CSS with message `feat: show AI request token usage`.

## Task 4: Settings Aggregates and Clear Command

**Files:**
- Modify: `editor/src/ai-config.ts`
- Modify: `editor/index.html`
- Modify: `editor/src/__tests__/ai-config.test.ts`

- [ ] **Step 1: Write failing settings tests**

```ts
it('renders aggregate usage and clears records after confirmation', () => {
  recordAIUsage({ timestamp: Date.now(), feature: 'enhance', provider: 'openai', model: 'gpt-5.6', inputTokens: 30, outputTokens: 10, cacheReadTokens: 15 });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const container = document.createElement('div');
  mountAISettingsPanel(container);
  expect(container.querySelector('#ai-usage-summary')?.textContent).toContain('40');
  expect(container.querySelector('#ai-usage-summary')?.textContent).toContain('50%');
  container.querySelector<HTMLButtonElement>('#ai-clear-usage')!.click();
  expect(getAIUsageSummary().recordCount).toBe(0);
});
```

Add an empty-state test requiring `No usage recorded in the last 30 days.`.

- [ ] **Step 2: Verify RED**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-config.test.ts`. Expected: FAIL because the token section does not exist.

- [ ] **Step 3: Implement the settings section**

Import usage helpers into `ai-config.ts`. Under the enabled toggle render `#ai-usage-summary` with input, output, total, cache-read, and either the reported hit rate or `Cache data not reported by this provider.`. Render per-feature and provider/model summaries, then a compact table containing only non-empty daily buckets. Add `#ai-clear-usage`, confirm with `window.confirm('Clear all local AI usage statistics?')`, clear only on approval, then remount.

Style `.ai-usage-section`, `.ai-usage-summary`, `.ai-usage-breakdown`, and `.ai-usage-table` in `editor/index.html`; support horizontal table scrolling and explicit dark-mode colors.

- [ ] **Step 4: Verify GREEN and commit**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-config.test.ts`. Expected: PASS. Commit settings, styles, and tests with message `feat: display AI token usage statistics`.

## Task 5: Full Verification and Local Update

**Files:**
- Modify: `docs/superpowers/plans/2026-08-11-ai-usage-and-prompt-cache.md`

- [ ] **Step 1: Run all tests**

Run `pnpm --dir editor test`. Expected: all test files pass.

- [ ] **Step 2: Build and check the patch**

Run `pnpm --dir editor build && git diff --check`. Expected: build succeeds and no whitespace errors.

- [ ] **Step 3: Update the local app and commit the plan**

Run `./quick-update.sh`, then commit this plan with message `docs: plan AI usage tracking implementation`.
