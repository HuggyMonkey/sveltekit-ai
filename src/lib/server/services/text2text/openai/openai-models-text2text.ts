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

  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  logit_bias: z.record(z.number()).optional(),
  stop: z.array(z.string()).optional(),
  logprobs: z.number().optional(),
  top_logprobs: z.number().optional(),
  response_format: z.enum(['text', 'json_schema']).optional(),
  structured_outputs: z.boolean().optional(),
  tool_choice: z.union([z.literal('auto'), z.literal('none'), z.literal('required'), z.string()]).optional(),
  previous_response_id: z.string().optional(),
  truncation: z.enum(['auto', 'disabled']).optional(),
  parallel_tool_calls: z.boolean().optional(),
  include: z.array(z.string()).optional(),
  metadata: z.record(z.string()).optional(),

  apiKey: z.string().optional(),
  debug: z.boolean().optional(),
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

    frequency_penalty,
    presence_penalty,
    logit_bias,
    stop,
    logprobs,
    top_logprobs,
    response_format,
    structured_outputs,
    tool_choice,
    previous_response_id,
    truncation,
    parallel_tool_calls,
    include,
    metadata,

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
      frequency_penalty,
      presence_penalty,
      logit_bias,
      stop,
      logprobs,
      top_logprobs,
      response_format,
      structured_outputs,
      tool_choice,
      previous_response_id,
      truncation,
      parallel_tool_calls,
      include,
      metadata,
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