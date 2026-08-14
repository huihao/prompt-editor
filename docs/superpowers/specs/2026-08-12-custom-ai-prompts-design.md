# Custom AI Prompts Design

## Goal

Allow users to choose between the built-in system prompt and a locally saved custom system prompt for each AI-assisted writing feature:

- Prompt Enhance
- AI Autocomplete
- Prompt Orchestration

The feature must preserve existing AI provider settings and behavior for users who do not configure custom prompts.

## Scope

This change covers system prompts only. It does not change provider selection, model configuration, user-message construction, streaming, usage tracking, workflow parsing, or native storage protocols.

Prompt settings remain browser-side configuration stored with the existing AI configuration in `localStorage`.

## Configuration Model

Add three prompt feature identifiers:

```ts
type AIPromptFeature = 'enhance' | 'autocomplete' | 'orchestration';
```

Each feature has an independent setting:

```ts
interface AIPromptSetting {
  mode: 'default' | 'custom';
  content: string;
}

type AIPromptSettings = Record<AIPromptFeature, AIPromptSetting>;
```

`AIConfig` gains an optional `prompts` field. Keeping the field optional makes stored configurations from earlier releases valid without a migration write. Reading code normalizes missing or malformed prompt settings to default mode.

The custom `content` is retained when a user switches temporarily from custom mode to default mode. The explicit reset action clears it. This lets a user compare the default behavior without losing their draft.

## Default Prompt Ownership

Move all three built-in system prompts into one prompt configuration module. It exports immutable defaults and a resolver:

```ts
getAIPrompt(feature: AIPromptFeature, config?: AIConfig | null): string
```

Resolution rules are:

1. Use the supplied configuration when provided; otherwise read the stored AI configuration.
2. Return custom content only when the feature is in custom mode and trimmed custom content is non-empty.
3. Return the built-in prompt in all other cases.

This makes the built-in text the single source of truth for the settings preview and every AI request. Empty custom content therefore cannot result in an empty system prompt.

## Settings Experience

Add `Prompt Writing` as a dedicated tab in the existing Settings modal, alongside `General` and `AI Provider`. The AI Provider tab retains provider, model, API key, enablement, connection testing, and token usage controls, but no longer renders prompt editors.

The dedicated prompt settings UI lives in a focused `ai-prompt-settings.ts` module rather than adding prompt form behavior to `settings-ui.ts` or retaining it inside the provider panel. `settings-ui.ts` only registers and activates the tab.

The section contains one editor for each feature. Each editor has:

- A feature name.
- A two-option mode selector: `Use default` or `Custom`.
- A multiline prompt text area.
- A `Reset to default` command.

When default mode is active, the text area is disabled and shows the built-in prompt. When custom mode is active, it is editable and shows the saved custom content. If no custom content exists when custom mode is selected, the editor starts with the built-in prompt so the user can modify rather than rewrite it.

Changing a selector or text area only modifies the panel's in-memory form state. `Save` merges the prompt settings into the stored AI configuration. `Cancel`, closing the modal, or clicking outside discards unsaved edits.

In the dedicated tab, `Save` updates only `AIConfig.prompts` while preserving every existing provider field. If no AI configuration exists yet, saving prompt settings creates a configuration using the same OpenAI defaults currently used by the AI Provider panel. Saving or cancelling closes the Settings modal consistently with the AI Provider tab.

Resetting an individual feature immediately changes that form entry to default mode and clears its custom content, but remains unsaved until the user chooses `Save`.

Text areas are populated through DOM `value` assignments after the settings markup is created. User-controlled prompt text is never interpolated into `innerHTML`.

## AI Request Integration

The three request sites call the shared resolver immediately before constructing their messages:

- Prompt Enhance resolves `enhance`.
- AI Autocomplete resolves `autocomplete` for every suggestion request.
- Prompt Orchestration resolves `orchestration` for every workflow generation or regeneration request.

The resolved text remains a system message. The existing user message, request options, streaming callbacks, token accounting, and error handling are unchanged.

Reading at request time means saved settings take effect on the next AI operation without rebuilding the editor extension or reopening the application.

## Compatibility And Failure Handling

- A missing `prompts` field behaves exactly like the current release.
- Unknown modes, absent feature entries, non-string content, invalid JSON, or empty custom content fall back to the built-in prompt.
- Existing provider settings are preserved when prompt settings are saved.
- A custom prompt may affect output format. Existing parsing and empty-response errors remain responsible for reporting invalid provider output, especially for orchestration JSON.
- Prompt data stays local and is sent only as part of the corresponding AI request, consistent with current built-in system prompts.

## Localization And Layout

Add English-to-Chinese translations for the `Prompt Writing` tab label, feature labels, modes, reset command, and supporting field labels. Prompt bodies themselves are not translated because they are executable instructions.

The existing settings modal remains the container. Prompt editors use compact field spacing and full-width text areas with a stable minimum height. The Prompt Writing content panel scrolls vertically on smaller windows. At narrow widths, the three settings tabs remain in the existing top tab row and prompt editor controls stack without horizontal overflow.

## Testing

Add focused tests for:

- Default prompt resolution with no saved AI configuration.
- Backward-compatible resolution from an AI configuration without `prompts`.
- Custom resolution for each feature.
- Empty or malformed custom values falling back to the built-in prompt.
- The settings panel rendering all three prompt editors.
- The Settings modal rendering `Prompt Writing` as a third tab.
- The AI Provider tab not rendering prompt editors.
- Switching modes, editing content, resetting one feature, saving, and cancelling without persistence.
- Prompt-only saves preserving provider configuration fields.
- Special characters in saved custom prompts rendering as text.
- Prompt Enhance passing its resolved custom system prompt.
- AI Autocomplete passing its resolved custom system prompt.
- Prompt Orchestration passing its resolved custom system prompt.
- Existing AI configuration and feature test suites continuing to pass.

## Acceptance Criteria

1. Users can independently select default or custom system prompts for all three AI writing features.
2. Saved custom prompts apply to the next request for the matching feature only.
3. Selecting default always uses the current built-in prompt.
4. Empty, missing, or invalid custom settings safely use the built-in prompt.
5. Existing stored AI configurations continue to work without user action.
6. Cancelling settings leaves persisted prompt configuration unchanged.
7. The complete editor test and build checks pass.
