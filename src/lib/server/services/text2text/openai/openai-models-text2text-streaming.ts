import { z } from 'zod';
import { OpenAI } from 'openai';
import { getEnv, missingApiKeyError, isAsyncIterable } from '$lib/server/services/shared/utils';
import { buildOpenAIPayload } from '$lib/server/services/shared/openai-utils';

// Accepts any OpenAI model name for text2text streaming tasks
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
  abortSignal: z.any().optional(),
});

export type Input = z.infer<typeof schema>;

// Streaming returns an AsyncIterable of response events
export type Output =
  | {
      success: true;
      data: AsyncIterable<any>;
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

export async function openai_models_text2text_streaming(input: Input): Promise<Output> {
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
    abortSignal,

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
      stream: true, // enable streaming
    });

    const resp = await client.responses.create(payload as any, { signal: abortSignal });
    if (isAsyncIterable(resp)) {
      // It's a stream
      return {
        success: true,
        data: resp as AsyncIterable<any>,
      };
    } else {
      // Not a stream, treat as error or handle as non-streaming
      return {
        success: false,
        error: {
          message: 'Expected a streaming response but got a non-streaming response.',
          code: 'NOT_STREAMING',
          details: resp,
        },
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: 'LLM streaming request failed',
        code: err.code,
        status: err.status,
        details: err,
      },
    };
  }
}
