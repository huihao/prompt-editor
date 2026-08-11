# Streaming Workflow Preview Design

## Goal

Render completed workflow stages while the AI response is still streaming, without parsing or rendering incomplete JSON.

## Data Flow

`prompt-orchestration-ui.ts` will append every AI text chunk to the existing raw response buffer. A pure parser in `prompt-orchestration.ts` will scan the `stages` array character-by-character, tracking quoted strings, escaping, and object depth. It will expose only stage object slices whose braces have closed; each slice must pass `JSON.parse` before it becomes preview data.

The UI will replace its preview only when the set of complete stages grows. It will normalize those stages with the same validation rules used for final workflows and use a fallback workflow title while the top-level title is incomplete. Incomplete objects, malformed fragments, and subsequent partial chunks remain in the buffer and never reach the DOM.

## Completion And Failure

When the stream completes, `parseWorkflowResponse` remains authoritative: only a complete, valid workflow enables Save. It replaces the preview with the final normalized workflow so title and all fields are canonical. A stream error or an invalid final document leaves Save disabled and shows the error; preview data is not persisted.

## Verification

- Unit test scanner behavior across chunks split inside a string, escape sequence, and nested object.
- Unit test that only complete stage objects are emitted and malformed completed slices are ignored.
- UI test that stages appear during chunk delivery but Save stays disabled until `onDone` receives valid final JSON.
- Run focused tests, all editor tests, production build, then package the updated editor into the macOS app bundle.
