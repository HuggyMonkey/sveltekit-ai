import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

import { OPENAI_API_KEY } from '$env/static/private';


import { openai_gpt4o_mini_text2text, type Input } from '$lib/server/services/text2text/openai/openai-gpt4o_mini-text2text';

// Accept the user query from the frontend
const apiInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(10000, 'Query too long'),
});

// Define system prompt/instructions and model parameters on the server
const SYSTEM_PROMPT = 'You are a helpful AI assistant.';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parsedInput = apiInputSchema.safeParse(body);
    
    if (!parsedInput.success) {
      return json({
        success: false,
        error: {
          message: 'Invalid request format',
          code: 'INVALID_INPUT',
          details: parsedInput.error.flatten(),
        }
      }, { status: 400 });
    }

    // Build the service input using client-side data and server-side data
    const serviceInput: Input = {
      apiKey: OPENAI_API_KEY,
      input: parsedInput.data.query,
      instructions: SYSTEM_PROMPT,
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
    };

    // Call the LLM service
    const result = await openai_gpt4o_mini_text2text(serviceInput);

    // Handle service errors
    if (!result.success) {
      console.error('LLM service error:', result.error);
      
      return json({
        success: false,
        error: {
          message: result.error.message,
          code: result.error.code || 'SERVICE_ERROR',
        }
      }, { status: 500 });
    }

    // Log successful requests (without sensitive data)
    console.log('LLM request successful:', {
      model: result.data.meta?.model,
      inputLength: parsedInput.data.query.length,
      outputLength: result.data.text.length,
      usage: result.data.usage,
    });


    // Return only necessary data to frontend
    return json({
      success: true,
      data: {
        text: result.data.text,
        usage: result.data.usage ? {
          input_tokens: result.data.usage.input_tokens,
          output_tokens: result.data.usage.output_tokens,
          total_tokens: result.data.usage.total_tokens,
        } : undefined,
      }
    });

  } catch (error) {
    // Handle unexpected errors
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