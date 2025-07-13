import { env } from '$env/dynamic/private';

export function getEnv(name: string): string | undefined {
  return env[name];
}

export const missingApiKeyError = (provider: string) => ({
  success: false,
  error: {
    message: `${provider} API key is missing. Provide it via input.apiKey or set the ${provider.toUpperCase()}_API_KEY environment variable.`,
    code: 'MISSING_API_KEY'
  }
});