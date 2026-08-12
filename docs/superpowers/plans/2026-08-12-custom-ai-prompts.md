# Custom AI Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users independently choose built-in or custom system prompts for Prompt Enhance, AI Autocomplete, and Prompt Orchestration.

**Architecture:** A focused `ai-prompts.ts` module owns the three built-in prompts, prompt-setting normalization, and request-time resolution. `ai-config.ts` persists optional prompt settings and renders three editors inside the existing AI settings panel. Each AI feature resolves its system prompt immediately before calling `streamAIText`, so changes apply without restarting the editor.

**Tech Stack:** TypeScript 5.4, Vitest 1.6, jsdom, CodeMirror 6, localStorage, Vite 5.

## Global Constraints

- Prompt settings affect system messages only; provider selection, user messages, streaming, token usage, and native storage protocols remain unchanged.
- Existing stored `AIConfig` objects without `prompts` must continue to work without a migration write.
- Missing, malformed, or blank custom prompt content must resolve to the built-in prompt.
- Saved prompt text must be assigned through DOM properties, never interpolated into `innerHTML`.
- Prompt bodies are executable instructions and must not be translated.

---

## File Map

- Create `editor/src/ai-prompts.ts`: prompt feature types, built-in prompt constants, normalization, and request-time resolution.
- Create `editor/src/__tests__/ai-prompts.test.ts`: isolated resolver and compatibility coverage.
- Modify `editor/src/ai-config.ts`: optional prompt configuration plus settings form state, editors, reset, save, and cancel behavior.
- Modify `editor/src/__tests__/ai-config.test.ts`: settings rendering, persistence, reset, cancellation, and safe text rendering.
- Modify `editor/src/ai-enhance.ts`: resolve the Enhance prompt per generation.
- Modify `editor/src/ai-autocomplete.ts`: resolve the Autocomplete prompt per suggestion.
- Modify `editor/src/prompt-orchestration-ui.ts`: resolve the Orchestration prompt per generation.
- Modify `editor/src/__tests__/ai-features.test.ts`: verify Enhance and Autocomplete system messages.
- Modify `editor/src/__tests__/prompt-orchestration-ui.test.ts`: verify the Orchestration system message.
- Modify `editor/src/i18n.ts`: Chinese labels for the new settings controls.
- Modify `editor/index.html`: compact prompt editor styles, dark mode, and narrow-window behavior.

---

### Task 1: Shared Prompt Model And Resolver

**Files:**
- Create: `editor/src/ai-prompts.ts`
- Create: `editor/src/__tests__/ai-prompts.test.ts`
- Modify: `editor/src/ai-config.ts`

**Interfaces:**
- Consumes: `AIConfig` from `editor/src/ai-config.ts` through a type-only import.
- Produces: `AIPromptFeature`, `AIPromptMode`, `AIPromptSetting`, `AIPromptSettings`, `AI_PROMPT_FEATURES`, `DEFAULT_AI_PROMPTS`, `normalizeAIPromptSettings(value)`, and `getAIPrompt(feature, config?)`.

- [ ] **Step 1: Write failing resolver tests**

Create `editor/src/__tests__/ai-prompts.test.ts` with cases equivalent to:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_AI_PROMPTS,
  getAIPrompt,
  normalizeAIPromptSettings,
} from '../ai-prompts';
import type { AIConfig } from '../ai-config';

const config = (prompts?: AIConfig['prompts']): AIConfig => ({
  provider: 'openai', model: 'gpt-5.6', apiKey: 'key', enabled: true, prompts,
});

describe('AI prompt resolution', () => {
  beforeEach(() => localStorage.clear());

  it('uses built-in prompts without stored configuration', () => {
    expect(getAIPrompt('enhance')).toBe(DEFAULT_AI_PROMPTS.enhance);
  });

  it('supports old AI configurations without prompt settings', () => {
    expect(getAIPrompt('autocomplete', config())).toBe(DEFAULT_AI_PROMPTS.autocomplete);
  });

  it('returns an independent custom prompt for every feature', () => {
    for (const feature of ['enhance', 'autocomplete', 'orchestration'] as const) {
      expect(getAIPrompt(feature, config({
        enhance: { mode: 'default', content: '' },
        autocomplete: { mode: 'default', content: '' },
        orchestration: { mode: 'default', content: '' },
        [feature]: { mode: 'custom', content: `custom ${feature}` },
      }))).toBe(`custom ${feature}`);
    }
  });

  it('falls back for blank and malformed custom values', () => {
    expect(getAIPrompt('enhance', config({
      enhance: { mode: 'custom', content: '   ' },
    } as AIConfig['prompts']))).toBe(DEFAULT_AI_PROMPTS.enhance);
    expect(normalizeAIPromptSettings({ enhance: { mode: 'other', content: 4 } }))
      .toEqual(expect.objectContaining({ enhance: { mode: 'default', content: '' } }));
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-prompts.test.ts`.

Expected: FAIL because `../ai-prompts` does not exist.

- [ ] **Step 3: Add the configuration type and prompt module**

Add an optional field to `AIConfig`:

```ts
prompts?: AIPromptSettings;
```

Create `ai-prompts.ts` and move the exact current prompt bodies out of the three feature modules:

```ts
export type AIPromptFeature = 'enhance' | 'autocomplete' | 'orchestration';
export type AIPromptMode = 'default' | 'custom';
export interface AIPromptSetting { mode: AIPromptMode; content: string; }
export type AIPromptSettings = Record<AIPromptFeature, AIPromptSetting>;
export const AI_PROMPT_FEATURES = ['enhance', 'autocomplete', 'orchestration'] as const;

export function normalizeAIPromptSettings(value: unknown): AIPromptSettings {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(AI_PROMPT_FEATURES.map(feature => {
    const entry = source[feature] && typeof source[feature] === 'object'
      ? source[feature] as Record<string, unknown> : {};
    return [feature, {
      mode: entry.mode === 'custom' ? 'custom' : 'default',
      content: typeof entry.content === 'string' ? entry.content : '',
    }];
  })) as AIPromptSettings;
}

export function getAIPrompt(feature: AIPromptFeature, config = getAIConfig()): string {
  const setting = normalizeAIPromptSettings(config?.prompts)[feature];
  return setting.mode === 'custom' && setting.content.trim()
    ? setting.content
    : DEFAULT_AI_PROMPTS[feature];
}
```

Use `import type { AIConfig }` and a normal `getAIConfig` import. If that produces a runtime cycle, pass a small stored-config reader into the module or move `getAIConfig` to a focused storage module; do not duplicate the storage key or prompt resolution logic.

- [ ] **Step 4: Run the test and verify GREEN**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-prompts.test.ts src/__tests__/ai-config.test.ts`.

Expected: both files PASS, including old configurations without `prompts`.

- [ ] **Step 5: Commit the shared model**

```bash
git add editor/src/ai-prompts.ts editor/src/__tests__/ai-prompts.test.ts editor/src/ai-config.ts
git commit -m "feat: add configurable AI prompt resolver"
```

### Task 2: Prompt Editors In AI Settings

**Files:**
- Modify: `editor/src/ai-config.ts`
- Modify: `editor/src/__tests__/ai-config.test.ts`
- Modify: `editor/src/i18n.ts`
- Modify: `editor/index.html`

**Interfaces:**
- Consumes: `AI_PROMPT_FEATURES`, `DEFAULT_AI_PROMPTS`, and `normalizeAIPromptSettings` from Task 1.
- Produces: saved `AIConfig.prompts` entries for all three features, with DOM IDs `ai-prompt-mode-<feature>`, `ai-prompt-content-<feature>`, and `ai-prompt-reset-<feature>`.

- [ ] **Step 1: Write failing settings behavior tests**

Extend `ai-config.test.ts` with tests that:

```ts
it('renders independent prompt editors and saves custom content', () => {
  const container = document.createElement('div');
  mountAISettingsPanel(container);

  expect(container.querySelectorAll('[data-ai-prompt-editor]')).toHaveLength(3);
  const mode = container.querySelector<HTMLSelectElement>('#ai-prompt-mode-enhance')!;
  const content = container.querySelector<HTMLTextAreaElement>('#ai-prompt-content-enhance')!;
  expect(content.disabled).toBe(true);

  mode.value = 'custom';
  mode.dispatchEvent(new Event('change', { bubbles: true }));
  expect(content.disabled).toBe(false);
  content.value = '<improve & preserve> "quoted"';
  container.querySelector<HTMLButtonElement>('#ai-save-btn')!.click();

  expect(getAIConfig()?.prompts?.enhance).toEqual({
    mode: 'custom', content: '<improve & preserve> "quoted"',
  });
});

it('resets one prompt locally and preserves a custom draft when only switching modes', () => {
  // Seed all three custom entries, mount, switch enhance to default, and assert
  // its textarea still contains the draft. Click reset and assert mode default,
  // textarea contains DEFAULT_AI_PROMPTS.enhance, and the other entries are unchanged.
});

it('does not persist prompt edits when cancelled', () => {
  const onCancel = vi.fn();
  const container = document.createElement('div');
  mountAISettingsPanel(container, { onCancel });
  // Change the Enhance form, click #ai-cancel-btn, then assert getAIConfig()
  // still equals the seeded object and onCancel ran once.
});
```

Also remount after saving the special-character prompt and assert `textarea.value` equals the original literal text and no injected element exists.

- [ ] **Step 2: Run the settings test and verify RED**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-config.test.ts`.

Expected: FAIL because prompt editor elements are absent.

- [ ] **Step 3: Render prompt form state safely**

In `mountAISettingsPanel`, normalize prompt settings once into mutable panel-local state. Render only stable labels and empty textareas in the template:

```html
<section class="ai-prompt-settings">
  <h3>Prompt writing</h3>
  <div class="ai-prompt-editor" data-ai-prompt-editor="enhance">
    <div class="ai-prompt-editor-heading">
      <label for="ai-prompt-mode-enhance">Prompt Enhance</label>
      <select id="ai-prompt-mode-enhance">
        <option value="default">Use default</option>
        <option value="custom">Custom</option>
      </select>
    </div>
    <textarea id="ai-prompt-content-enhance"></textarea>
    <button id="ai-prompt-reset-enhance" type="button" class="ai-btn-secondary">Reset to default</button>
  </div>
</section>
```

Generate the repeated stable markup from `AI_PROMPT_FEATURES`. After assigning `innerHTML`, set every textarea through `.value`. On mode changes, preserve `setting.content`; when entering custom mode with no content, copy the built-in prompt into `setting.content`. On reset, set `{ mode: 'default', content: '' }`, disable the textarea, and display the built-in prompt.

On Save, include a deep copy of the three panel-local prompt settings in `newConfig`. The existing Cancel handler must remain callback-only.

- [ ] **Step 4: Add localized copy and responsive styles**

Add translations for `Prompt writing`, `Prompt Enhance`, `AI Autocomplete`, `Prompt Orchestration`, `Use default`, `Custom`, and `Reset to default`.

Add styles using the existing settings palette:

```css
.ai-prompt-settings { border-top: 1px solid var(--border, #e5e5e5); padding-top: 14px; }
.ai-prompt-settings h3 { margin: 0 0 10px; font-size: 13px; }
.ai-prompt-editors { display: grid; gap: 10px; }
.ai-prompt-editor { display: grid; gap: 7px; padding: 10px; border: 1px solid var(--border, #e5e5e5); border-radius: 7px; }
.ai-prompt-editor-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ai-prompt-editor textarea { box-sizing: border-box; width: 100%; min-height: 112px; resize: vertical; padding: 8px 10px; font: 12px/1.45 ui-monospace, monospace; }
.ai-prompt-editor textarea:disabled { opacity: 0.7; cursor: default; }
.ai-prompt-editor > button { justify-self: start; }
```

Extend dark-mode input styles to textareas. At `max-width: 560px`, stack `.ai-prompt-editor-heading` and keep all controls within the content width.

- [ ] **Step 5: Run focused UI tests and verify GREEN**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-config.test.ts src/__tests__/settings-ui.test.ts src/__tests__/i18n.test.ts`.

Expected: all three files PASS.

- [ ] **Step 6: Commit the settings experience**

```bash
git add editor/src/ai-config.ts editor/src/__tests__/ai-config.test.ts editor/src/i18n.ts editor/index.html
git commit -m "feat: add custom AI prompt settings"
```

### Task 3: Resolve Prompts At All Three Request Sites

**Files:**
- Modify: `editor/src/ai-enhance.ts`
- Modify: `editor/src/ai-autocomplete.ts`
- Modify: `editor/src/prompt-orchestration-ui.ts`
- Modify: `editor/src/__tests__/ai-features.test.ts`
- Modify: `editor/src/__tests__/prompt-orchestration-ui.test.ts`

**Interfaces:**
- Consumes: `getAIPrompt(feature)` from Task 1.
- Produces: the resolved feature-specific content as the first `role: 'system'` message in every generation request.

- [ ] **Step 1: Write failing request-message tests**

Update the `../ai-config` mocks to retain `isAIConfigured`, and mock `../ai-prompts`:

```ts
const getAIPromptMock = vi.fn((feature: string) => `custom ${feature}`);
vi.mock('../ai-prompts', () => ({
  getAIPrompt: (...args: unknown[]) => getAIPromptMock(...args),
}));
```

Add assertions after triggering each feature:

```ts
expect(streamAITextMock.mock.calls[0][0][0]).toEqual({
  role: 'system', content: 'custom enhance',
});

// After the autocomplete debounce:
expect(streamAITextMock.mock.calls[0][0][0]).toEqual({
  role: 'system', content: 'custom autocomplete',
});

// After clicking Generate workflow:
expect(streamAITextMock.mock.calls[0][0][0]).toEqual({
  role: 'system', content: 'custom orchestration',
});
```

- [ ] **Step 2: Run feature tests and verify RED**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-features.test.ts src/__tests__/prompt-orchestration-ui.test.ts`.

Expected: FAIL because feature modules still use local constants.

- [ ] **Step 3: Replace local constants with request-time resolution**

Delete the three local prompt constants. Import `getAIPrompt` and resolve inside each request function:

```ts
{ role: 'system', content: getAIPrompt('enhance') }
{ role: 'system', content: getAIPrompt('autocomplete') }
{ role: 'system', content: getAIPrompt('orchestration') }
```

Keep all user-message construction, callbacks, and `{ feature: ... }` request metadata unchanged. Resolution must occur each time Enhance/Regenerate, autocomplete suggestion, or workflow Generate/Regenerate runs.

- [ ] **Step 4: Run feature and resolver tests and verify GREEN**

Run `pnpm --dir editor exec vitest run src/__tests__/ai-prompts.test.ts src/__tests__/ai-features.test.ts src/__tests__/prompt-orchestration-ui.test.ts`.

Expected: all three files PASS.

- [ ] **Step 5: Commit request integration**

```bash
git add editor/src/ai-enhance.ts editor/src/ai-autocomplete.ts editor/src/prompt-orchestration-ui.ts editor/src/__tests__/ai-features.test.ts editor/src/__tests__/prompt-orchestration-ui.test.ts
git commit -m "feat: apply custom prompts to AI features"
```

### Task 4: Full Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-08-12-custom-ai-prompts.md` only to check completed steps before committing the plan.

**Interfaces:**
- Consumes: completed implementation from Tasks 1-3.
- Produces: a typechecked, tested, production-built editor with no patch whitespace errors.

- [ ] **Step 1: Run the full editor test suite**

Run `pnpm --dir editor test`.

Expected: every Vitest suite passes.

- [ ] **Step 2: Run TypeScript and production build verification**

Run `pnpm --dir editor typecheck` and then `pnpm --dir editor build`.

Expected: both commands exit successfully.

- [ ] **Step 3: Check the final patch**

Run `git diff --check` and `git status --short`.

Expected: no whitespace errors; `.pnpm-store/` remains unrelated and untracked.

- [ ] **Step 4: Commit the implementation plan**

```bash
git add docs/superpowers/plans/2026-08-12-custom-ai-prompts.md
git commit -m "docs: plan custom AI prompt settings"
```
