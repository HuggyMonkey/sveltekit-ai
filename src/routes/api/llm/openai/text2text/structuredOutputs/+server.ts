import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

import { OPENAI_API_KEY } from '$env/static/private';
import { openai_models_text2text_structuredOutputs, type Input } from '$lib/server/services/text2text/openai/openai-models-text2text-structuredOutputs';

// Define API input schema 
const apiInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(5000),
});



// This schema represents an array of strings (words) containing between 10 and 20 items
const relatedItemsSchemaZod = z.object({
  relatedItems: z.array(
    z.string().min(1, "Each item must be a non-empty word")
  ).min(10, "At least 10 words required").max(20, "No more than 20 words allowed")
});

// Define server-side constants
const SYSTEM_PROMPT = 'You are a helpful AI that returns responses in structured JSON.';
const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse and validate request body
    const body = await request.json();
    const parsed = apiInputSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        {
          success: false,
          error: {
            message: 'Invalid request format',
            code: 'INVALID_INPUT',
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const { query } = parsed.data;

    // Construct service input
    const serviceInput: Input = {
      apiKey: OPENAI_API_KEY,
      input: query,
      model: DEFAULT_MODEL,
      instructions: SYSTEM_PROMPT,
      response_format: {
        type: 'json_schema',
        name: 'relatedItems',
        schema: relatedItemsSchemaZod,
        strict: true
      },
      temperature: DEFAULT_TEMPERATURE,
      max_output_tokens: DEFAULT_MAX_OUTPUT_TOKENS
    };

    // Call the LLM service
    const result = await openai_models_text2text_structuredOutputs(serviceInput);

    // Handle service failure
    if (!result.success) {
      console.error('Structured Output Service Error:', result.error);
      return json(
        {
          success: false,
          error: {
            message: result.error.message,
            code: result.error.code ?? 'LLM_FAILURE'
          }
        },
        { status: 500 }
      );
    }

    // Log safe metadata
    console.log('Structured Output LLM success:', {
      model: result.meta?.model,
      usage: result.usage
    });

    console.log('Structured Output LLM result:', result.data);

    // Return safe response
    return json({
      success: true,
      data: result.data,
      usage: result.usage
    });
  } catch (error) {
    console.error('Unexpected API error:', error);
    return json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      },
      { status: 500 }
    );
  }
};
