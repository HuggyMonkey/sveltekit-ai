# 🚀 Production-Grade Text2Text Streaming Service Guide

> This guide provides a comprehensive reference for building robust, production-ready text2text streaming services that follow our established service design patterns. It covers critical production considerations, implementation patterns, and provider-agnostic best practices.

---

## 📋 Table of Contents

1. [Production Requirements](#production-requirements)
2. [Service Architecture](#service-architecture)
3. [Critical Production Considerations](#critical-production-considerations)
4. [Implementation Reference](#implementation-reference)
5. [Provider Adaptation Guide](#provider-adaptation-guide)
6. [Testing & Validation](#testing--validation)
7. [Deployment Checklist](#deployment-checklist)

---

## 🎯 Production Requirements

### Core Capabilities
- **Real-time streaming** of LLM responses with low latency
- **Graceful error handling** for network failures, API errors, and malformed data
- **Resource management** with proper cleanup and abort handling
- **Type safety** with comprehensive input/output validation
- **Provider agnostic** design for easy model switching
- **Monitoring** and debugging capabilities

### Performance Targets
- **First token latency**: < 2 seconds
- **Token streaming rate**: 20-50 tokens/second
- **Error recovery**: < 5 second timeout with retry logic
- **Memory efficiency**: No memory leaks from abandoned streams

---

## 🏗️ Service Architecture

### File Structure
```
$lib/server/services/text2text/[provider]/
├── [provider]-models-text2text-streaming.ts     ← Main service
├── [provider]-[specific-model]-text2text.ts     ← Non-streaming variant
└── types.ts                                     ← Shared types (optional)
```

### Naming Convention
```
[provider]-models-text2text-streaming.ts    ← Multi-model support
[provider]-[model]-text2text-streaming.ts   ← Single model support
```

**Examples:**
- `openai-models-text2text-streaming.ts`
- `anthropic-claude-text2text-streaming.ts`
- `google-gemini-text2text-streaming.ts`

---

## ⚠️ Critical Production Considerations

### 1. **Client Disconnect Handling** 🔴 **CRITICAL**

**Problem**: Clients may disconnect before stream completion, leaving expensive API calls running.

**Solution**: Implement `AbortSignal` propagation throughout the call stack.

```typescript
export const schema = z.object({
  // ... other fields
  abortSignal: z.any().optional(), // Accept AbortSignal from caller
});

export async function provider_models_text2text_streaming(input: Input): Promise<Output> {
  const { abortSignal, /* other params */ } = parsed.data;
  
  // Pass signal to the LLM client
  const response = await client.create(payload, { signal: abortSignal });
  
  return {
    success: true,
    data: response // AsyncIterable that respects the signal
  };
}
```

**API Route Integration:**
```typescript
export const POST: RequestHandler = async ({ request }) => {
  const serviceInput = {
    // ... other params
    abortSignal: request.signal, // SvelteKit provides this
  };
  
  const result = await provider_models_text2text_streaming(serviceInput);
  
  if (result.success) {
    return new ReadableStream({
      async start(controller) {
        for await (const chunk of result.data) {
          // Check if client disconnected
          if (request.signal.aborted) {
            break; // Stop processing immediately
          }
          // ... process chunk
        }
      }
    });
  }
};
```

### 2. **Input Validation & Security** 🔴 **CRITICAL**

**Schema Design:**
```typescript
export const schema = z.object({
  input: z.string().min(1).max(100000), // Prevent DoS attacks
  model: z.string().min(1, 'Model name is required'),
  instructions: z.string().optional(),
  
  // Rate limiting parameters
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_output_tokens: z.number().min(1).max(8192).optional(), // Prevent runaway costs
  
  // Security
  apiKey: z.string().optional(), // Never log this field
  abortSignal: z.any().optional(),
  debug: z.boolean().optional(),
});
```

**Server-Side Parameter Control:**
```typescript
// 🚨 CRITICAL: Never let clients control system prompts or core model params
// Allow client control only if it is a necessary function of your application
const SYSTEM_PROMPT = 'You are a helpful AI assistant.'; // Server-controlled
const DEFAULT_MODEL = 'gpt-4o-mini'; // Server-controlled
const MAX_TOKENS = 4096; // Server-controlled limits

const serviceInput: Input = {
  apiKey: OPENAI_API_KEY, // Server-controlled
  input: parsed.data.query, // Client data
  model: DEFAULT_MODEL, // Server overrides client choice
  instructions: SYSTEM_PROMPT, // Server-controlled
  max_output_tokens: Math.min(parsed.data.max_tokens || 1024, MAX_TOKENS),
};
```

### 3. **Error Handling & Resilience** 🟡 **HIGH PRIORITY**

**Comprehensive Error Coverage:**
```typescript
export async function provider_models_text2text_streaming(input: Input): Promise<Output> {
  // 1. Input validation errors
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

  // 2. API key validation
  const resolvedApiKey = apiKey ?? getEnv('PROVIDER_API_KEY');
  if (!resolvedApiKey) {
    return {
      success: false,
      error: {
        message: 'Missing API key for Provider',
        code: 'MISSING_API_KEY',
      },
    };
  }

  try {
    // 3. LLM API call errors
    const resp = await client.create(payload, { signal: abortSignal });
    
    // 4. Response format validation
    if (!isAsyncIterable(resp)) {
      return {
        success: false,
        error: {
          message: 'Expected streaming response but got non-streaming',
          code: 'NOT_STREAMING',
          details: resp,
        },
      };
    }

    return { success: true, data: resp };
    
  } catch (err: any) {
    // 5. Network, rate limiting, and SDK errors
    return {
      success: false,
      error: {
        message: 'LLM streaming request failed',
        code: err.code || 'UNKNOWN_ERROR',
        status: err.status,
        details: process.env.NODE_ENV === 'development' ? err : undefined,
      },
    };
  }
}
```

### 4. **Memory Management** 🟡 **HIGH PRIORITY**

**Resource Cleanup:**
```typescript
// Client-side stream processing
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    
    try {
      for await (const chunk of result.data) {
        // Critical: Check for abort on every iteration
        if (request.signal.aborted) {
          break;
        }
        
        // Process and forward chunk
        const payload = `data: ${JSON.stringify(chunk)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }
    } catch (error) {
      // Ensure errors are forwarded to client
      const errorPayload = `event: error\ndata: ${JSON.stringify({ 
        message: error.message 
      })}\n\n`;
      controller.enqueue(encoder.encode(errorPayload));
    } finally {
      // Always close the stream
      controller.close();
    }
  },
});
```

### 5. **Type Safety & Contracts** 🟡 **HIGH PRIORITY**

**Strict Output Types:**
```typescript
export type StreamChunk = {
  text?: string;
  done?: boolean;
  error?: {
    message: string;
    code?: string;
  };
  metadata?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      total_tokens?: number;
    };
  };
};

export type Output =
  | {
      success: true;
      data: AsyncIterable<StreamChunk>;
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
```

---

## 📚 Implementation Reference

### Complete Service Template

```typescript
import { z } from 'zod';
import { ProviderSDK } from 'provider-sdk';
import { getEnv, missingApiKeyError, isAsyncIterable } from '$lib/server/services/shared/utils';
import { buildProviderPayload } from '$lib/server/services/shared/provider-utils';

// Input validation schema
export const schema = z.object({
  input: z.string().min(1).max(100000),
  model: z.string().min(1, 'Model name is required'),
  instructions: z.string().optional(),
  
  // Generation parameters
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_output_tokens: z.number().min(1).max(8192).optional(),
  
  // Provider-specific parameters
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  
  // Infrastructure
  apiKey: z.string().optional(),
  debug: z.boolean().optional(),
  abortSignal: z.any().optional(),
});

export type Input = z.infer<typeof schema>;

// Stream chunk type
export type StreamChunk = {
  text?: string;
  done?: boolean;
  error?: {
    message: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
};

// Service output type
export type Output =
  | {
      success: true;
      data: AsyncIterable<StreamChunk>;
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

/**
 * Production-grade streaming text2text service for [Provider] models
 * 
 * Features:
 * - Abort signal support for client disconnect handling
 * - Comprehensive error handling and validation
 * - Resource cleanup and memory management
 * - Type-safe input/output contracts
 * - Debug mode for development
 */
export async function provider_models_text2text_streaming(input: Input): Promise<Output> {
  // 1. Input validation
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
    abortSignal,
    // ... other parameters
  } = parsed.data;

  // 2. API key validation
  const resolvedApiKey = apiKey ?? getEnv('PROVIDER_API_KEY');
  if (!resolvedApiKey) {
    return missingApiKeyError('Provider') as Output;
  }

  // 3. Initialize client
  const client = new ProviderSDK({ apiKey: resolvedApiKey });

  try {
    // 4. Build request payload
    const payload = buildProviderPayload({
      model,
      input: userInput,
      instructions,
      temperature,
      top_p,
      max_output_tokens,
      stream: true, // Enable streaming
      // ... other parameters
    });

    // 5. Make streaming request with abort signal
    const resp = await client.createStream(payload, { 
      signal: abortSignal 
    });

    // 6. Validate response format
    if (!isAsyncIterable(resp)) {
      return {
        success: false,
        error: {
          message: 'Expected streaming response but got non-streaming',
          code: 'NOT_STREAMING',
          details: debug ? resp : undefined,
        },
      };
    }

    // 7. Return success with stream
    return {
      success: true,
      data: resp as AsyncIterable<StreamChunk>,
    };

  } catch (err: any) {
    // 8. Handle all errors
    return {
      success: false,
      error: {
        message: 'LLM streaming request failed',
        code: err.code || 'UNKNOWN_ERROR',
        status: err.status,
        details: debug ? err : undefined,
      },
    };
  }
}
```

### Corresponding API Route

```typescript
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';

import { PROVIDER_API_KEY } from '$env/static/private';
import { provider_models_text2text_streaming, type Input } from '$lib/server/services/text2text/provider/provider-models-text2text-streaming';

// API input validation (stricter than service)
const apiInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(10000, 'Query too long'),
  model: z.string().optional(), // Optional, server can override
});

// Server-controlled parameters
const SYSTEM_PROMPT = 'You are a helpful AI assistant.';
const DEFAULT_MODEL = 'provider-default-model';
const MAX_OUTPUT_TOKENS = 4096;

export const POST: RequestHandler = async ({ request }) => {
  try {
    // 1. Parse and validate API input
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

    // 2. Build service input with server-controlled parameters
    const serviceInput: Input = {
      apiKey: PROVIDER_API_KEY,
      input: parsed.data.query,
      model: parsed.data.model || DEFAULT_MODEL,
      instructions: SYSTEM_PROMPT,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      abortSignal: request.signal, // CRITICAL: Pass abort signal
    };

    // 3. Call the streaming service
    const result = await provider_models_text2text_streaming(serviceInput);
    if (!result.success) {
      return json({
        success: false,
        error: result.error,
      }, { status: 500 });
    }

    // 4. Stream response to client
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of result.data) {
            // CRITICAL: Check for client disconnect
            if (request.signal.aborted) {
              break;
            }
            
            // Handle error chunks
            if (chunk.error) {
              const errorPayload = `event: error\ndata: ${JSON.stringify(chunk.error)}\n\n`;
              controller.enqueue(encoder.encode(errorPayload));
              break;
            }
            
            // Forward data chunks
            const dataPayload = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(encoder.encode(dataPayload));
          }
        } catch (error) {
          // Handle streaming errors
          const errorPayload = `event: error\ndata: ${JSON.stringify({
            message: 'Stream processing failed',
            code: 'STREAM_ERROR'
          })}\n\n`;
          controller.enqueue(encoder.encode(errorPayload));
        } finally {
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

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
```

---

## 🔄 Provider Adaptation Guide

### OpenAI → Anthropic

**Key Changes:**
```typescript
// 1. SDK Import
- import { OpenAI } from 'openai';
+ import { Anthropic } from '@anthropic-ai/sdk';

// 2. Client initialization
- const client = new OpenAI({ apiKey: resolvedApiKey });
+ const client = new Anthropic({ apiKey: resolvedApiKey });

// 3. API call
- const resp = await client.responses.create(payload, { signal: abortSignal });
+ const resp = await client.messages.stream(payload, { signal: abortSignal });

// 4. Environment variable
- const resolvedApiKey = apiKey ?? getEnv('OPENAI_API_KEY');
+ const resolvedApiKey = apiKey ?? getEnv('ANTHROPIC_API_KEY');
```

### OpenAI → Google Gemini

**Key Changes:**
```typescript
// 1. SDK Import
- import { OpenAI } from 'openai';
+ import { GoogleGenerativeAI } from '@google/generative-ai';

// 2. Client initialization
- const client = new OpenAI({ apiKey: resolvedApiKey });
+ const genAI = new GoogleGenerativeAI(resolvedApiKey);
+ const model = genAI.getGenerativeModel({ model: modelName });

// 3. API call
- const resp = await client.responses.create(payload, { signal: abortSignal });
+ const resp = await model.generateContentStream(prompt, { signal: abortSignal });

// 4. Response processing
+ // Gemini returns different chunk format - adapt accordingly
```

### Custom Provider Integration

**Steps:**
1. **Create provider-specific utils** in `$lib/server/services/shared/`
2. **Adapt the schema** for provider-specific parameters
3. **Update payload building** logic for provider's API format
4. **Modify response parsing** to match provider's stream format
5. **Add provider-specific error codes** and handling

---

## 🧪 Testing & Validation

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { provider_models_text2text_streaming } from './provider-models-text2text-streaming';

describe('provider_models_text2text_streaming', () => {
  it('should validate input correctly', async () => {
    const result = await provider_models_text2text_streaming({
      input: '', // Invalid: empty string
      model: 'test-model',
    });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('INVALID_INPUT');
  });

  it('should handle missing API key', async () => {
    const result = await provider_models_text2text_streaming({
      input: 'test query',
      model: 'test-model',
      // No apiKey provided and no env var
    });
    
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('MISSING_API_KEY');
  });

  it('should handle abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    
    const result = await provider_models_text2text_streaming({
      input: 'test query',
      model: 'test-model',
      apiKey: 'test-key',
      abortSignal: controller.signal,
    });
    
    // Should fail due to aborted signal
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

```typescript
import { POST } from './+server';

describe('Streaming API Integration', () => {
  it('should stream response chunks', async () => {
    const request = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ query: 'Hello world' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST({ request });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    
    // Test stream consumption
    const reader = response.body?.getReader();
    const { value } = await reader?.read() || {};
    const chunk = new TextDecoder().decode(value);
    expect(chunk).toMatch(/^data: /);
  });
});
```

---

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] **Input validation** covers all edge cases and security concerns
- [ ] **Error handling** is comprehensive and doesn't leak sensitive data
- [ ] **Abort signal handling** is implemented throughout the call stack
- [ ] **Resource cleanup** is guaranteed in all code paths
- [ ] **API rate limits** are configured and respected
- [ ] **Monitoring** and logging are set up for production debugging
- [ ] **Environment variables** are properly configured and secured

### Security Review

- [ ] **API keys** are never logged or exposed in responses
- [ ] **System prompts** are server-controlled and not client-modifiable
- [ ] **Input sanitization** prevents injection attacks
- [ ] **Output limits** prevent runaway costs and DoS attacks
- [ ] **CORS policies** are properly configured for production domains

### Performance Validation

- [ ] **First token latency** meets performance targets (< 2s)
- [ ] **Memory usage** is stable under load with no leaks
- [ ] **Error recovery** is fast and graceful
- [ ] **Concurrent streams** are handled efficiently
- [ ] **Client disconnect handling** prevents orphaned processes

### Monitoring Setup

- [ ] **Error rate monitoring** for service failures
- [ ] **Latency monitoring** for performance regression detection
- [ ] **Token usage tracking** for cost management
- [ ] **Rate limit monitoring** to prevent API quota exhaustion
- [ ] **Resource usage alerts** for memory and CPU spikes

---

## 📈 Production Metrics

### Key Performance Indicators

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| First Token Latency | < 2s | > 5s |
| Error Rate | < 1% | > 5% |
| Memory Usage | Stable | Growing trend |
| Token Cost | Tracked | Budget exceeded |
| Client Disconnect Rate | < 10% | > 25% |

### Alerting Rules

```yaml
# Example alerting configuration
- alert: HighStreamingErrorRate
  expr: streaming_error_rate > 0.05
  for: 5m
  annotations:
    summary: "High error rate in streaming service"

- alert: HighStreamingLatency
  expr: streaming_first_token_latency_p95 > 5s
  for: 2m
  annotations:
    summary: "High latency in streaming service"
```

---

## 🎯 Summary

This guide provides a comprehensive foundation for building production-grade text2text streaming services. The key to success is:

1. **Comprehensive error handling** at every layer
2. **Proper resource management** with abort signal support
3. **Strong type safety** with validation at boundaries
4. **Security-first design** with server-controlled parameters
5. **Thorough testing** including edge cases and integration scenarios

Following these patterns ensures your streaming services are robust, scalable, and maintainable in production environments.