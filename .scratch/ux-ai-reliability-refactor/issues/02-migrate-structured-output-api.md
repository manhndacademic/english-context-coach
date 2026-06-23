# Migrate Gemini provider to official Structured Output API

Status: done

## Parent

[PRD.md](../PRD.md)

## What to build

The Gemini provider currently uses the legacy `responseMimeType` + `responseSchema` API with a custom 191-line `zodToGeminiSchema()` converter. A `!isGemini3` workaround disables structured output for 3 of the 5 default models. This is the root cause of frequent JSON format errors.

Migrate end-to-end to the official API:

1. **Remove Gemma from default model pool** — keep only Gemini models as defaults (`gemini-3.1-flash-lite` primary, `gemini-3-flash-preview` and `gemini-3.5-flash` as fallbacks). Preserve backward-compat code for user-configured Gemma models.

2. **Add `zod-to-json-schema` dependency** and migrate the provider config from `responseMimeType`/`responseSchema` to `responseFormat: { text: { mimeType: "application/json", schema: zodToJsonSchema(zodSchema) } }`. Remove the `!isGemini3` check — the official API works with all models. See ADR-0023.

3. **Delete the custom `zodToGeminiSchema()` function** (191 lines in gemini-utils) and its tests — replaced by the npm package.

4. **Add AbortController timeout** (60s default, configurable via `GEMINI_TIMEOUT_MS` env var) to prevent hung API connections. Classify timeout errors as transient for re-queue.

5. **Simplify `JsonParserService`** — add a fast path that tries `JSON.parse()` directly (should succeed with structured output), falling back to the existing repair pipeline. Keep value-level sanitization (`sanitizeValue`, `coerceJsonForSchema`).

6. **Remove debug `console.log`** in api-rotation-pool.

Verify by running existing AI adapter tests, then manually pasting text and confirming analysis completes without JSON errors.

## Acceptance criteria

- [ ] Default model pool contains only Gemini models with `gemini-3.1-flash-lite` as primary
- [ ] Provider uses `responseFormat.text` API (not `responseMimeType`/`responseSchema`)
- [ ] `zod-to-json-schema` used for schema conversion (no custom `zodToGeminiSchema`)
- [ ] `isGemini3` check removed for schema (kept for `thinkingConfig` only)
- [ ] AbortController with 60s timeout wraps all API calls
- [ ] `JsonParserService` has fast path (`JSON.parse`) + fallback path
- [ ] No `console.log` debug statements in api-rotation-pool
- [ ] `bun run test` passes (AI adapter tests updated)
- [ ] `bun run typecheck` passes
- [ ] `bun run build` passes
- [ ] Manual test: paste text → analysis completes without JSON errors

## Blocked by

None — can start immediately.
