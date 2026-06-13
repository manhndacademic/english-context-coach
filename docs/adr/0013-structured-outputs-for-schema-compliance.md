# Structured Outputs for Schema Compliance

When the AI provider generates responses, they must strictly match our Zod schemas (e.g. key phrase categories, text types, or exercise structures). Previously, the application relied on text-based prompt instructions and validated the results with Zod. If the model output invalid values (such as `"academic"` as a key phrase category), the validation failed. The system then executed a repair loop followed by an outer retry loop, creating up to 4 sequential LLM calls and ballooning latency to 15–25 seconds.

We decided to implement native Structured Outputs schema enforcement at the API level. We will dynamically translate Zod schemas (including objects, arrays, enums, unions, discriminated unions, and literal types) into Gemini OpenAPI Schema definitions and pass them in `responseSchema` to the Google GenAI SDK. Since the API key and models (both Gemini and Gemma) support structured schemas, this strictly constrains the models to return compliant JSON on the first try, dropping latency back to the fast 2–5 second baseline and eliminating repair/retry overhead entirely.

## Considered Options

- **Text-only prompts with validation repair**: Existing behavior—frequently fails on subtle enum values, causing multiple LLM calls and severe latency spikes (15-25 seconds).
- **Zod-to-OpenAPI translation**: Dynamic schema translation at runtime passed directly in `responseSchema`—guarantees schema compliance on the first try, maintains low latency (2-5 seconds), and requires no external compiler libraries.
- **External schema compiler libraries**: Adding compiler packages (like `@anatine/zod-openapi`)—rejected because a simple, recursive helper in the provider provides exact type mappings for standard Zod schemas without adding package footprint.
