import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

import { OPENAI_API_KEY } from '$env/static/private';

import { openai_models_text2text_streaming, type Input } from '$lib/server/services/text2text/openai/openai-models-text2text-streaming';
import { isAsyncIterable } from '$lib/server/services/shared/utils';

const apiInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(10000, 'Query too long'),
});

// Define system prompt/instructions and model parameters on the server
const SYSTEM_PROMPT = 'You are a helpful AI assistant.';
const DEFAULT_MODEL = 'gpt-4o-mini';


export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const parsed = apiInputSchema.safeParse(body);
    if (!parsed.success) {
      return json({
        success: false,
        error: {
          message: 'Invalid request format',
          code: 'INVALID_INPUT',
          details: parsed.error.flatten(),
        }
      }, { status: 400 });
    }

    // Build the service input using client-side data and server-side data
    const serviceInput: Input = {
      apiKey: OPENAI_API_KEY,
      input: parsed.data.query,
      model: DEFAULT_MODEL,
      instructions: SYSTEM_PROMPT,
    };

    // Call the streaming service
    const result = await openai_models_text2text_streaming(serviceInput);
    if (!result.success) {
      return json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }

    // Stream the response to the client
    if (isAsyncIterable(result.data)) {
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const chunk of result.data) {
            // Check if the client has disconnected
            if (request.signal.aborted) {
              break;
            }
            if (chunk.error) {
              const errorPayload = `event: error\ndata: ${JSON.stringify(chunk.error)}\n\n`;
              controller.enqueue(encoder.encode(errorPayload));
              break; 
            }
            const dataPayload = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(dataPayload));
          }
          controller.close();
        },
      });
      
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      return json({
        success: false,
        error: {
          message: 'Streaming failed: not an async iterable',
          code: 'STREAM_ERROR',
        },
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Unexpected API error:', error);
    return json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
      }
    }, { status: 500 });
  }
}; 