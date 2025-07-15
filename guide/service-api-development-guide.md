# ⚙️ Developer Guide: Building SvelteKit API Routes for LLM Services

This guide provides a comprehensive walkthrough for creating production-grade SvelteKit API route endpoints that consume the universal LLM inferencing services.

The primary goal of the LLM inferencing services is to abstract away the complexity of interacting with different model providers. As a developer building an API, your main responsibility is to handle the data coming from your client, validate it, pass it to the appropriate service, and shape the response. This guide outlines the best practices for achieving this with a focus on security, robustness, and maintainability.

---

## 🏛️ Core Architectural Principles

1.  **Thin API Routes**: Your API route (`+server.ts`) should be as lean as possible. Its only jobs are to handle HTTP requests/responses, perform validation, and delegate all business logic to the LLM service.
2.  **Service as the Core Logic Unit**: All prompt engineering, parameter tuning, and provider-specific logic resides within the LLM service. The API route should remain agnostic to the underlying model provider.
3.  **Security First**: Never trust client input. Always validate the request body and control sensitive parameters (like system prompts or API keys) on the server.
4.  **Freedom of Implementation**: While this guide presents a production-ready template, you have the flexibility to adapt the API design to your application's specific needs. The key is to maintain a high standard of quality and security.

---

## API Route Template

The following example is a blueprint for building a robust API endpoint. It is based on a real, production-ready route in this codebase that consumes the `openai-gpt4o_mini-text2text` service.

**File Location**: `src/routes/api/llm/openai/text2text/+server.ts`

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

// 1. Securely import the API key
import { OPENAI_API_KEY } from '$env/static/private';

// 2. Import the target LLM service and its Input type
import { openai_gpt4o_mini_text2text, type Input } from '$lib/server/services/text2text/openai/openai-gpt4o_mini-text2text';

// 3. Define the API's input schema
const apiInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(10000, 'Query is too long'),
});

// 4. Define server-controlled parameters
const SYSTEM_PROMPT = 'You are a helpful AI assistant. Be concise and accurate.';
const DEFAULT_MODEL = 'gpt-4o-mini';

export const POST: RequestHandler = async ({ request }) => {
  // 5. Implement robust error handling
  try {
    // 6. Parse and validate the request body
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

    // 7. Build the service input
    const serviceInput: Input = {
      apiKey: OPENAI_API_KEY,
      input: parsedInput.data.query,
      instructions: SYSTEM_PROMPT,
      model: DEFAULT_MODEL,
      // Add other parameters like temperature, max_tokens, etc. here
    };

    // 8. Call the LLM service
    const result = await openai_gpt4o_mini_text2text(serviceInput);

    // 9. Handle errors from the service
    if (!result.success) {
      console.error('LLM Service Error:', result.error);
      return json({
        success: false,
        error: { message: result.error.message, code: result.error.code || 'SERVICE_ERROR' }
      }, { status: 500 }); // Use 500 for downstream service failures
    }

    // 10. Log successful requests for monitoring
    console.log('LLM Request Successful:', {
      model: result.data.meta?.model,
      usage: result.data.usage,
    });

    // 11. Return a clean, minimal response to the client
    return json({
      success: true,
      data: {
        text: result.data.text,
        usage: result.data.usage,
      }
    });

  } catch (error) {
    // Handle unexpected exceptions
    console.error('Unexpected API Error:', error);
    return json({
      success: false,
      error: { message: 'An internal server error occurred.', code: 'INTERNAL_ERROR' }
    }, { status: 500 });
  }
};
```

---

## 📝 Key Considerations and Guidelines

### 1. **API Key Management**
-   **DO**: Use SvelteKit's built-in environment variable management (`$env/static/private`). It's type-safe and validated at build time.
-   **DO NOT**: Expose API keys to the frontend or pass them directly from the client in the request body.
-   **DO NOT**: Use `$env/dynamic/private` unless you have a specific need for variables that are only available at runtime. Static is safer.

### 2. **Service Imports**
-   Always import the specific LLM service function you intend to use.
-   Import the `Input` type from the service to ensure type safety when constructing the `serviceInput` object.

### 3. **Input Schema and Validation**
-   Define a Zod schema (`apiInputSchema`) that is specific to your API endpoint. This decouples your API's public contract from the service's internal input shape.
-   For most applications, the API should only accept the user's `query` or essential data.
-   Keep validation rules strict (e.g., `min`, `max` length) to prevent abuse.

### 4. **Server-Controlled Parameters**
-   **DO**: Define `SYSTEM_PROMPT`, `model`, `temperature`, and other sensitive or configuration-critical parameters on the server.
-   **WHY**: This prevents clients from overriding your carefully crafted prompts or using expensive models, giving you full control over the AI's behavior and cost.

### 5. **Error Handling**
-   Wrap your entire request handler in a `try...catch` block to handle unexpected errors gracefully.
-   Always check if the `safeParse` operation was successful and return a `400 Bad Request` status if not.
-   After calling the service, check the `result.success` flag. If it's `false`, log the internal error and return a generic `500 Internal ServerError` to the client. This prevents leaking sensitive implementation details.

### 6. **Building the Service Input**
-   Carefully map the validated data from your API's input schema to the `Input` type required by the service.
-   This is where you combine the client-provided data (like the `query`) with the server-controlled data (like the `SYSTEM_PROMPT` and `OPENAI_API_KEY`).

### 7. **Handling the Service Response**
-   The LLM service will always return a `{ success, data }` or `{ success, error }` object. Your API route should never need its own `try...catch` around the service call itself.
-   Check the `success` flag to determine the outcome.

### 8. **Logging**
-   **DO**: Log important, non-sensitive metadata for successful requests, such as token usage and model name. This is invaluable for monitoring cost and performance.
-   **DO**: Log the full error object for both service errors and unexpected exceptions to aid in debugging.
-   **DO NOT**: Log the user's `query` or the full `text` response unless you have explicit requirements and have addressed privacy concerns.

### 9. **Shaping the Final Response**
-   Only return the data the client absolutely needs. In most cases, this is just the generated `text` and perhaps the `usage` stats.
-   Avoid returning the `meta` or `raw` fields from the service, as these are intended for server-side debugging.

---

## 🎨 Flexibility and Customization

This template provides a strong foundation. You are free to adapt it:

-   **Dynamic System Prompts**: You could introduce logic to select a `SYSTEM_PROMPT` based on the user's query or another parameter.
-   **Allowing Some Parameters**: For advanced applications, you might choose to let the client override certain non-critical parameters (like `temperature`). If you do, be sure to add them to your `apiInputSchema` with strict validation.
-   **Multiple Services**: A single API route could potentially call different LLM services based on the input, but this should be done with care to avoid creating an overly complex and hard-to-maintain endpoint.

By following these guidelines, you can build secure, reliable, and maintainable SvelteKit API routes that effectively leverage the power of the reusable LLM inferencing services. 