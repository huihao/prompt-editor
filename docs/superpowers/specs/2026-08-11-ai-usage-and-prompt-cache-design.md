# AI Usage and Prompt Cache Design

## Scope

Track successful AI calls from Prompt Enhance, Prompt Orchestration, and AI Autocomplete. Exclude Test Connection calls. Do not calculate costs.

The application stores no prompt text, generated text, API keys, or provider response payloads as part of usage tracking.

## Usage Collection

`streamAIText` will classify each request by feature and, after a successful stream, read the provider-normalized usage returned by the AI SDK. Each usage record contains:

- timestamp
- feature (`enhance`, `orchestration`, or `autocomplete`)
- provider and model
- input tokens and output tokens when reported
- cache-read, cache-write, and non-cached input tokens when reported

Providers may omit individual usage fields. The UI must label unavailable data as not reported and must not estimate token counts.

## Storage and Statistics

Usage records are persisted locally in a dedicated localStorage key. Records are retained for 30 days; older records are pruned when a new record is written.

The usage module provides aggregate totals, per-feature and per-model summaries, a 30-day daily series, cache hit rate (`cache-read / input`), and a clear operation. A cache hit rate is unavailable when no provider-reported input token total exists.

## User Interface

Successful Prompt Enhance and Prompt Orchestration results show a compact per-request usage line beside their completion controls. Autocomplete has no durable result panel, so its per-request usage is available only in the settings aggregate.

The AI Provider settings tab adds a Token usage section with:

- 30-day input, output, and total token totals
- cache-read tokens and cache hit rate
- summaries grouped by feature and selected provider/model
- a 30-day daily usage display
- a Clear usage data command with confirmation

No price estimate is displayed.

## Prompt Cache Strategy

All AI features keep their stable feature-specific instructions in the system message at the beginning of the request. Dynamic editor text and selection context remain in the final user message. This creates a stable request prefix for providers with implicit prompt caching.

For Anthropic, the stable system message receives the AI SDK `anthropic.cacheControl` ephemeral breakpoint. Other providers receive no unsupported cache-specific option and rely on their native implicit caching when available. Returned cache-read and cache-write usage is always the source of truth for reporting.

## Error Handling and Tests

Failed and cancelled requests create no usage record. Requests that complete with text but omit usage still complete normally and appear in request UI without token details.

Tests cover usage normalization, local retention and aggregation, only-successful-call recording, cache option placement, settings rendering and clearing, and per-request panel rendering when usage is available.
