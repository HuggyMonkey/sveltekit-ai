# Developer Guide: Naming Conventions for LLM Inferencing Services

## Purpose

This guide establishes a clear, consistent, and scalable naming convention for all large language model (LLM) inferencing services within our codebase. The naming pattern enables easy identification, organization, and automation of services across projects.

---

## Naming Pattern Overview

Each service name follows this structured pattern:

[provider]-[series]_[model]-[modality]-[outputMethod]-[context].ts

> Note: The [context] segment is optional and should only be used for hyper-specific services. See details below.

**Note:** The **[outputMethod]** segment is **optional** and may be omitted for typical non-streamable services. When omitted, it is assumed the service returns a standard, immediate (non-streaming) response with no special handling or response technique required.
> 

### Components

| Segment | Description | Example |
| --- | --- | --- |
| **provider** | The company or source of the LLM. Use lowercase, no spaces. | `openai`, `anthropic`, `gemini` |
| **series** | The LLM family or series name, indicating a model lineage or generation. | `gpt4o`, `claude`, `gemini` |
| **model** | The exact model or variant name within the series. Use underscores `_` for spaces or dots. | `mini`, `1_5_pro`, `opus` |
| **modality** | The input-output data types formatted as `input2output`, indicating data transformation. | `text2text`, `text2image`, `audio2text` |
| **outputMethod** | The method of delivering the output, describing response handling style. | `streaming`, `pooling`, `websocket`, `sync` |
| **context** | *(Optional)* A concise, task-specific descriptor for hyper-specific services. | `summarize`, `paraphrase`, `generate-avatar` |

---

## When to Use the Optional [context] Segment

The **[context]** name is **not required** for general-purpose services. For example, an OpenAI GPT model with a `text2text` modality can perform summarization, paraphrasing, and many other tasks by adjusting the prompt dynamically. In such cases, the service name does **not** need a context suffix like `-summarize`.

Add the **[context]** segment only when:

- The service uses a **special fine-tuned model** dedicated to a specific task (e.g., a summarization-only fine-tuned model).
- The service output is **specifically constrained or formatted** to a unique purpose (e.g., producing only summarized text).
- You want to **differentiate between multiple services** using the same model and modality but performing distinct specialized functions.

## When to Use the Optional [outputMethod] Segment

The **[outputMethod]** segment is **not required** for standard services that return a simple, immediate response (e.g., a typical JSON object or plain text result). For most general-purpose LLM services that do not require special output handling, you can omit this segment from the service name.

Include the **[outputMethod]** segment only when:

- The service uses a **non-standard response method** such as **streaming**, **websocket**, or **polling**.
- The output is **delivered incrementally**, over time, or requires a **custom handling strategy** on the frontend.
- You want to **explicitly document or differentiate** how the output is returned, especially when behavior varies between services using the same model and modality.

---

## Examples

| Service Name | Description |
| --- | --- |
| `openai-gpt4o_mini-text2text-streaming.ts` | OpenAI GPT-4o mini, text input/output, streaming output, general-purpose text generation |
| `anthropic-claude_opus-text2text-sync-answer-question.ts` | Anthropic Claude Opus, synchronous text Q&A |
| `gemini-gemini_1_5_pro-text2image-pooling-generate-avatar.ts` | Gemini 1.5 Pro, text to image, polling output for avatar generation |
| `openai-gpt4o_mini-text2text-streaming-summarize.ts` | OpenAI GPT-4o mini fine-tuned summarization, streaming output |

---

## Best Practices

### 1. Use **kebab-case** for the entire filename except for the `[series]_[model]` segment

- Example: `gpt4o_mini` not `gpt4o-mini` or `gpt4oMini`
- This improves readability and consistency.

### 2. Keep the naming **lowercase**

- Avoid uppercase letters or special characters (except underscores `_` for model part).

### 3. Use the `input2output` notation for modality

- Examples: `text2text`, `text2image`, `audio2text`

### 4. Keep the `outputMethod` clear and standardized *(only when used)*

- Allowed values: `streaming`, `pooling`, `websocket`, `sync`

### 5. Context should be **task-specific and concise** *(only when used)*

- Use clear verbs or nouns describing the specialized service function.
- Avoid overly long or vague terms.

---

## Folder Structure Recommendation

Organize services in folders reflecting modality or generation type:

$lib/server/services/
├── text2text/
│ ├── openai/
│ │ └── openai-gpt4o_mini-text2text-streaming.ts
│ ├── anthropic/
│ │ └── anthropic-claude_opus-text2text-sync-answer-question.ts
├── text2image/
├── gemini/
│ └── gemini-gemini_1_5_pro-text2image-pooling-generate-avatar.ts

This layout enhances discoverability and maintainability.

---

## Parsing and Automation

When parsing service names, split by dashes `-` into:

| Part | Example |
| --- | --- |
| Provider | `openai` |
| Series_Model | `gpt4o_mini` (split further by underscore) |
| Modality | `text2text` |
| OutputMethod | `streaming` |
| Context | `summarize` (optional) |

Example parsing function snippet (TypeScript):

```
type ServiceNameParts = {
  provider: string;
  series: string;
  model: string;
  modality: string;
  outputMethod: string;
  context?: string;
};

function parseServiceName(name: string): ServiceNameParts {
  const [provider, seriesModel, modality, outputMethod, ...contextParts] = name.split('-');
  const [series, model] = seriesModel.split('_');
  const context = contextParts.length ? contextParts.join('-') : undefined;
  return { provider, series, model, modality, outputMethod, context };
}
```

## Summary

Follow the pattern strictly for consistency.

Use kebab-case, with underscore only in the [series]_[model] segment.

Use input2output notation for modality.

Use clear, standardized output methods.

The [context] segment is optional — only include for hyper-specific or fine-tuned services.

Organize services in modality-based folders.