# Migrate to official Structured Output API (`responseFormat.text` + `zod-to-json-schema`)

Supersedes: ADR-0013 (Structured Outputs for Schema Compliance)

ADR-0013 introduced a custom `zodToGeminiSchema()` helper (191 lines) that translates Zod schemas into Gemini OpenAPI Schema definitions passed via `responseSchema`. It rejected external schema compiler libraries, arguing a simple recursive helper was sufficient.

In practice, the helper had significant gaps: it dropped `.describe()` metadata, ignored Zod constraints (min/max, regex), silently fell back to `STRING` for unsupported types (`ZodRecord`, `ZodTuple`, `ZodDate`), and did not propagate property descriptions to the Gemini API. More critically, a `!isGemini3` workaround was added to disable `responseSchema` for all Gemini 3 models — which are 3 of the 5 models in the default pool — because the old API (`responseMimeType` + `responseSchema`) did not work reliably with these models. The net effect was that structured output enforcement was inactive for most requests, and the system fell back to the 350-line `JsonParserService` repair pipeline, causing the JSON format errors and excessive retries the user observed.

We decided to migrate to the official Gemini Structured Output API as documented by Google: `responseFormat: { text: { mimeType: "application/json", schema } }` with `zod-to-json-schema` for schema conversion. This approach:

1. Uses the **current, supported API surface** rather than the legacy `responseMimeType`/`responseSchema` fields.
2. Replaces the custom 191-line converter with a well-maintained npm package (`zod-to-json-schema`) that produces standard JSON Schema and preserves `.describe()`, constraints, and all Zod types.
3. Eliminates the `isGemini3` workaround entirely — the official API works with all model families (Gemini 3, Gemma).
4. Enables Zod `.describe()` metadata to flow to the model, improving structured output accuracy.

The `JsonParserService` is simplified to a fast-path-with-fallback: `JSON.parse()` first (should succeed with structured output), falling back to the existing repair pipeline for edge cases or user-configured models that may not support structured output.

## Considered Options

- **Keep custom `zodToGeminiSchema` and fix `isGemini3` check only**: Minimal change — just remove the `!isGemini3` condition. Rejected because the old `responseMimeType`/`responseSchema` API is not the documented approach, and the custom converter's gaps (no `.describe()`, no constraints, silent `STRING` fallback) remain.
- **Adopt `zod-to-json-schema` with the old API fields**: Use the better schema converter but keep `responseMimeType`/`responseSchema`. Rejected because mixing the old API fields with a JSON Schema output (instead of Gemini's custom OpenAPI format) may cause type mismatches — the new `responseFormat.text.schema` explicitly accepts JSON Schema.
- **Adopt `zod-to-json-schema` with `responseFormat.text`**: Uses the official, documented API surface with a standard schema format. Chosen because it aligns with Google's current SDK documentation, eliminates all workarounds, and produces the highest-quality schema for the model.
