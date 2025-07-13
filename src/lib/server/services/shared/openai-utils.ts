// openai-utils.ts

export function buildOpenAIPayload(input: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(input).filter(([_, value]) => value !== undefined)
    );
}

export function parseOpenAIUsage(usage?: Record<string, any>) {
    if (!usage) return undefined;

    return {
        input_tokens: usage.input_tokens,
        input_tokens_details: usage.input_tokens_details,
        output_tokens: usage.output_tokens,
        output_tokens_details: usage.output_tokens_details,
        total_tokens: usage.total_tokens,
    };
}
