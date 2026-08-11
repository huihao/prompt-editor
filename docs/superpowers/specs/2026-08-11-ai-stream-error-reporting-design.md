# AI Stream Error Reporting Design

## Goal

Replace the opaque `No output generated. Check the stream for errors.` message with the actual provider error when an AI provider reports one during a streamed response.

## Scope

`editor/src/ai-service.ts` will consume the AI SDK's complete stream instead of only its text-only view. Text delta events will continue to invoke the existing chunk callback. Error events will invoke the existing error callback with their concrete error message. A completed stream without text or an error will be reported as an empty-response error rather than treated as success.

## Constraints

- Keep the existing `streamAIText` API and all request settings unchanged.
- Do not add a proxy, retry behavior, provider-specific request formats, or new UI controls.
- Preserve cancellation behavior and the current friendly handling for authentication and network failures.

## Verification

Add focused tests for text delivery, an error event delivered through the complete stream, and an empty completed stream. Run the focused test file, the full editor test suite, and the production build.
