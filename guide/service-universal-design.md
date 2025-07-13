# 🧩 Universal LLM Service Template Guide

This guide defines the structure and standards for building **modular, LLM services** that abstract a single input → inference → output task using any provider (OpenAI, Claude, Gemini, etc.).

These services are designed to be:

- **Provider-agnostic**
- **Stateless**
- **Validatable**
- **Composable**
- **Testable**

---

## 📁 Project Location

Each service lives inside:

```
$lib/server/services/[modality]/[provider]/[provider-model_modality(-outputMethod)(-context)].ts

```

### 🔤 Naming Convention

For file names, follow:

```
scss
CopyEdit
[provider]-[model_or_family]_modality(-outputMethod)?(-context)?.ts

```

Examples:

- `openai-gpt4o_mini-text2text.ts`
- `claude-3-sonnet-text2text-streaming.ts`
- `gemini-1_5-flash-text2image.ts`

---

## 🧠 Design Philosophy

Each LLM service is:

- A single **`async` function** with **strict input types**
- **Pure** (no side effects or state)
- Completely decoupled from frameworks like SvelteKit or Express
- Portable across backends, CLIs, workflows, or APIs

---

## ✅ Implementation Checklist

### 1. **Zod-Based Input Validation**

Use `zod` to strictly validate inputs:

```
export const schema = z.object({
  input: z.string().min(1),
  instructions: z.string().optional(),
  model: z.string().optional(),
  apiKey: z.string().optional(),
  debug: z.boolean().optional()
});

export type Input = z.infer<typeof schema>;

```

Then validate early:

```
const parsed = schema.safeParse(input);
if (!parsed.success) {
  return {
    success: false,
    error: {
      message: 'Invalid input',
      code: 'INVALID_INPUT',
      details: parsed.error.flatten()
    }
  };
}

```

---

### 2. **Typed Output Contract**

Use a consistent shape:

```
export type Output =
  | {
      success: true;
      data: {
        text: string;
        usage?: UsageStats;
        meta?: Record<string, unknown>;
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

```

`UsageStats` type is optional and should reflect the provider's format.

---

### 3. **Pure, Async Function Signature**

Every service is a single exported async function:

```
export async function model_service_name(input: Input): Promise<Output> { ... }

```

Name matches the file and model combination.

Must not rely on external context.

---

### 4. **Safe API Key Handling**

Support two methods:

- From `input.apiKey`
- From `process.env.MODEL_API_KEY`

Always fail clearly if key is missing:

```
if (!apiKey) {
  return {
    success: false,
    error: {
      message: 'Missing API key',
      code: 'MISSING_API_KEY'
    }
  };
}

```

---

### 5. **Try/Catch for All Inference Calls**

Catch SDK/HTTP errors explicitly:

```
try {
  const response = await modelClient.call(...);
  return { success: true, data: {...} };
} catch (err: any) {
  return {
    success: false,
    error: {
      message: 'Inference failed',
      code: err.code,
      status: err.status,
      details: err
    }
  };
}

```

---

### 6. **No Side Effects**

Your service must:

- ❌ Not write to DB
- ❌ Not log to console unless `debug` is on
- ❌ Not mutate globals
- ✅ Be a self-contained input/output engine

---

### 7. **Streaming Output (Optional)**

If the model supports streaming:

- Create a separate file: `streaming.ts`
- Return an async generator or readable stream
- Indicate clearly in the filename and return type

---

### 8. **Debug Mode (Optional)**

Support a `debug: boolean` input param:

```
if (debug) {
  return { ...data, raw: fullResponse };
}

```

Never include `raw` unless requested.

---

### 9. **Usage Reporting (Optional)**

If supported, include token or cost stats:

```
usage: {
  input_tokens: 500,
  output_tokens: 300,
  total_tokens: 800,
  estimated_cost_usd: 0.0021
}

```

If not available, omit gracefully.

---

### 10. **Reusable Utility Functions**

Use helpers when possible for:

- Cleaning undefined values from payloads
- Shaping usage stats
- Normalizing error format

✅ Example shared utils:

```
export function buildPayload(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([_, v]) => v !== undefined));
}

export function parseUsageFromResponse(resp: any) {
  return {
    input_tokens: resp.input_tokens,
    output_tokens: resp.output_tokens,
    total_tokens: resp.total_tokens
  };
}

```

---

## 📦 Final Folder Example

```
bash
CopyEdit
/services
  ├── text2text
  │   ├── openai
  │   │   └── openai-gpt4o_mini-text2text.ts
  │   ├── anthropic
  │   │   └── claude-3-haiku-text2text-streaming.ts
  │   └── google
  │       └── gemini-1_5-pro-text2text.ts
  ├── text2image
  │   └── google
  │       └── gemini-1_5-flash-text2image.ts
  └── _shared
      └── payload-utils.ts

```

---

## 🚀 Getting Started

To scaffold a new model service:

1. Duplicate an existing file like `openai-gpt4o_mini-text2text.ts`
2. Rename based on the naming convention
3. Swap SDK/client for the target provider
4. Adjust schema + output shape
5. Replace response parsing logic
6. Add debug/usage support if needed

---

## 📌 Summary