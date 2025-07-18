# 🧩 LLM Service Template Guide

> This guide outlines how to create a new  model inferencing service using a standardized template. It explains the structure, components, reusable utilities, and how to adapt the template for new models and modalities.
> 

---

## 📂 File Structure

```

$lib/server/services/
│
├── text2text/
│   └── openai/
│       └── openai-gpt4o_mini-text2text.ts   ← ✅ Example service
│
├── _shared/
│   └── openai-utils.ts                      ← 🔁 Shared helpers (buildPayload, parseUsage)

```

---

## ✅ Service Purpose

Each service abstracts a specific `[model modality]` block behind a single `async` function. It handles:

- Input validation
- API key handling
- Model inference
- Output shaping (including usage & metadata)
- Optional debugging output

This keeps SvelteKit API routes lightweight and allows service logic to be reused across projects.

---

## 🧱 Service Template Structure

Here’s how the service is structured using `openai-gpt4o_mini-text2text.ts` as the reference.

### 1. **Zod Schema Input Validation**

```

export const schema = z.object({
  input: z.string().min(1),
  instructions: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional().default(1.0),
  max_output_tokens: z.number().optional().default(1024),
  apiKey: z.string().optional(),
  // Additional advanced parameters...
  debug: z.boolean().optional(),
});

```

- Define allowed input shape
- Apply defaults for standard parameters
- Enforce clean contracts between frontend and backend

---

### 2. **Output Shape**

```

export type Output =
  | { success: true; data: { text: string; usage?; meta?; raw? } }
  | { success: false; error: { message: string; code?; status?; details? } };

```

- Always returns a structured object.
- Allows robust API handling without try/catch on the client side.

---

### 3. **Async Inference Function**

```

export async function openai_gpt4o_mini_text2text(input: Input): Promise<Output> {
  // ✅ Validate input
  // ✅ Construct OpenAI client using provided or env key
  // ✅ Build payload with only defined fields
  // ✅ Call model
  // ✅ Shape response into success/error
}

```

- Leverages shared helpers (`buildOpenAIPayload`, `parseOpenAIUsage`)
- Accepts optional `debug: true` to return raw model output

---

## ♻️ Shared Helpers

In: `$lib/server/services/_shared/openai-utils.ts`

### `buildOpenAIPayload(input)`

```

Object.fromEntries(Object.entries(input).filter(([_, v]) => v !== undefined))

```

Cleans up the payload so only defined values are sent.

### `parseOpenAIUsage(usage)`

Returns structured token usage, matching OpenAI’s format:

```

{
  input_tokens,
  input_tokens_details,
  output_tokens,
  output_tokens_details,
  total_tokens
}

```

---

## 🛠️ How to Create a New Service

### 📌 Step-by-Step:

### 1. **Copy the template**

Use `openai-gpt4o_mini-text2text.ts` as your starting point.

### 2. **Rename and place into correct path**

Use the naming convention and place under the right folder:

```

$lib/server/services/[modality]/[provider]/[name].ts

```

### Example:**openai-gpt4o_mini-text2text.ts
claude-haiku-text2text.ts
gemini-1_5-flash-text2image.ts**

### 3. **Update schema**

Adjust validation for:

- Input type
- Required/optional parameters
- Supported advanced options

### 4. **Swap model client**

```

// OpenAI → Anthropic → Google
import { OpenAI } from 'openai';
// → import { GoogleGenerativeAI } from '@google/generative-ai';

```

Adjust `client.responses.create()` to match the new SDK and endpoint.

### 5. **Adapt the output parser**

E.g.:

```

const outputText = response.output?.[0]?.content?.text ?? '';

```

Update this to reflect the provider's response structure.

---

## 📎 Examples of Adaptations

### ✅ Claude Haiku Text2Text

```

// services/text2text/anthropic/claude-haiku-text2text.ts
- Update `model` default to "claude-3-haiku-20240307"
- Replace OpenAI client with Anthropic client
- Parse response.completion

```

---

### ✅ Gemini 1.5 Pro Text2Image

```

// services/text2image/google/gemini-1_5-pro-text2image.ts
- Input: z.object({ prompt: z.string(), imageData: z.any() })
- Replace OpenAI with @google/generative-ai
- Use gemini.pro.generateContent()
- Output: URL or base64 image

```

---

### ✅ OpenAI GPT-4o Mini with Streaming

```

// services/text2text/openai/openai-gpt4o_mini-text2text-streaming.ts
- Use `client.chat.completions.create({ stream: true })`
- Return AsyncIterable instead of `text`
- Handle stream parsing internally

```

---

## 📓 Notes for Contributors

- Always match service file name to expected capabilities.
- Only include `[context]` or `[outputMethod]` when:
    - Context is hyper-specific (e.g. summarization-only model)
    - Output method is non-standard (e.g. streaming, websocket)
- Keep the service single-purpose. Do not mix streamable + non-streamable logic.
- Prefer shared helpers for parsing and cleaning input/output.

---

## 📌 Final Checklist Before Committing

| ✅ Item | Description |
| --- | --- |
| Service name matches spec | Follows `provider-model-modality-outputMethod-context.ts` |
| All inputs validated | With Zod schema and safe defaults |
| Errors are wrapped | In `success: false` structure |
| API key handling safe | Supports `input.apiKey` or fallback |
| Shared helpers reused | For payload and usage |
| Raw debug optional | Only returned if `debug: true` |