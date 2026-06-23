/**
 * Port for verifying that an AI provider API key is valid and usable.
 * Returns null when the key is valid, or a Vietnamese error message when it fails.
 */
export interface ApiKeyVerifier {
  verify(apiKey: string): Promise<string | null>;
}
