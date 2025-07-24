import { z } from 'zod';
import { zodTextFormat } from "openai/helpers/zod"
import { OpenAI } from 'openai';
import { getEnv, missingApiKeyError } from '$lib/server/services/shared/utils';
import { buildOpenAIPayload, parseOpenAIUsage } from '$lib/server/services/shared/openai-utils';

// Service schema
export const schema = z.object({
  input: z.string().min(1),
  model: z.string().min(1),
  instructions: z.string().min(1),
  response_format: z.object({
    type: z.literal('json_schema'),
    name: z.string().min(1),
    schema: z.any(),
    strict: z.boolean().optional().default(true),
  }),
  temperature: z.number().min(0).max(2).default(0.7),
  top_p: z.number().min(0).max(1).optional(),
  max_output_tokens: z.number().optional(),
  apiKey: z.string().optional(),
  debug: z.boolean().optional(),
});

export type Input = z.infer<typeof schema>;

export type Output =
  | {
      success: true;
      data: unknown;
      usage?: ReturnType<typeof parseOpenAIUsage>;
      meta?: { model: string; parameters: Record<string, unknown> };
      raw?: unknown;
    }
  | {
      success: false;
      error: { message: string; code?: string; status?: number; details?: unknown };
    };

export async function openai_models_text2text_structuredOutputs(input: Input): Promise<Output> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: { message: 'Invalid input', code: 'INVALID_INPUT', details: parsed.error.flatten() } };

  const {
    input: userInput,
    model,
    instructions,
    response_format,
    temperature,
    top_p,
    max_output_tokens,
    apiKey,
    debug,
  } = parsed.data;

  const key = apiKey ?? getEnv('OPENAI_API_KEY');
  if (!key) return missingApiKeyError('OpenAI') as Output;

  const client = new OpenAI({ apiKey: key });

  try {
    const payload = buildOpenAIPayload({
      model,
      input: userInput,
      instructions,
      temperature,
      top_p,
      max_output_tokens,
      text: {
        format: zodTextFormat(response_format.schema, response_format.name),
      },
    });

    const response = await client.responses.create(payload as any);

    if (response.status === "incomplete" && response?.incomplete_details?.reason === "max_output_tokens") {
        return {
            success: false,
            error: { message: "Incomplete response", code: "INCOMPLETE_RESPONSE", details: response.incomplete_details },
        };
    }

    let parsedJson: unknown;
    const content = response.output_text ?? "";

    try {
      parsedJson = JSON.parse(content ?? "");
    } catch {
      return {
        success: false,
        error: { message: "Failed to parse JSON output", details: content },
      };
    }

    return {
      success: true,
      data: parsedJson,
      usage: parseOpenAIUsage(response.usage),
      meta: {
        model: response.model,
        parameters: { model, temperature, top_p, max_output_tokens },
      },
      ...(debug ? { raw: response } : {}),
    };
  } catch (err: any) {
    return { success: false, error: { message: 'LLM structured output failed', code: err.code, status: err.status, details: err } };
  }
}
