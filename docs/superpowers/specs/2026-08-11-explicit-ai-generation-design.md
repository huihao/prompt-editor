# Explicit AI Generation Design

## Goal

Open Prompt enhance and Prompt orchestration panels without issuing an AI request; generation begins only after an explicit user action.

## Interaction

Prompt enhance opens in a ready state with an `Enhance` action, no output cursor, and disabled Apply. Clicking it starts the existing stream; after completion or failure, the action becomes `Regenerate`.

Prompt orchestration opens in a ready state that describes the pending workflow generation. Its current generation action reads `Generate workflow` until clicked, then retains the existing streaming preview, strict final validation, error, and retry behavior. Saved workflows continue to open as editable data without a request.

## Verification

Tests assert neither panel calls `streamAIText` upon opening, then assert explicit activation calls it and preserves existing output behavior. Run focused tests, full editor tests, production build, and update the local macOS app bundle.
