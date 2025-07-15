import { z } from 'zod';
import { OpenAI } from 'openai';
import { buildOpenAIPayload, parseOpenAIUsage } from '$lib/server/services/shared/openai-utils';
import { getEnv, missingApiKeyError } from '$lib/server/services/shared/utils';

// Accepts any OpenAI model name for text2text tasks
export const schema = z.object({
  input: z.string().min(1),
  model: z.string().min(1, 'Model name is required'),
  instructions: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_output_tokens: z.number().optional(),
  apiKey: z.string().optional(),
  debug: z.boolean().optional(),
  // Add any other advanced OpenAI params as needed
});

export type Input = z.infer<typeof schema>;

export type Output =
  | {
      success: true;
      data: {
        text: string;
        usage?: ReturnType<typeof parseOpenAIUsage>;
        meta?: {
          model: string;
          parameters: Record<string, unknown>;
        };
        raw?: unknown;
      };
    }
  | {
      success: false;
      error: {
        message: string;
        code?: string;
        status?: number;
        details?: unknown;
      };
    };

export async function openai_models_text2text(input: Input): Promise<Output> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: {
        message: 'Invalid input',
        code: 'INVALID_INPUT',
        details: parsed.error.flatten(),
      },
    };
  }

  const {
    input: userInput,
    model,
    instructions,
    temperature,
    top_p,
    max_output_tokens,
    apiKey,
    debug,
    // ...other advanced params
  } = parsed.data;

  const resolvedApiKey = apiKey ?? getEnv('OPENAI_API_KEY');
  if (!resolvedApiKey) {
    return missingApiKeyError('OpenAI') as Output;
  }

  const client = new OpenAI({ apiKey: resolvedApiKey });

  try {
    const payload = buildOpenAIPayload({
      model,
      input: userInput,
      instructions,
      temperature,
      top_p,
      max_output_tokens,
      // ...other advanced params
    });

    const response = await client.responses.create(payload as any);

    return {
      success: true,
      data: {
        text: response.output_text ?? '',
        usage: parseOpenAIUsage(response.usage),
        meta: {
          model: response.model,
          parameters: {
            model,
            temperature,
            top_p,
            max_output_tokens,
          },
        },
        ...(debug && { raw: response }),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: 'LLM request failed',
        code: err.code,
        status: err.status,
        details: err,
      },
    };
  }
} 