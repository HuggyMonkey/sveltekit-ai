# 🧭 Developer Guide: Naming Conventions for LLM Inferencing Services

## Purpose

This guide establishes a clear, consistent, and scalable naming convention for all large language model (LLM) inferencing services within our codebase. The naming pattern enables easy identification, organization, and automation of services across projects.

---

## 🧩 Naming Pattern Overview

Each service name follows this structured pattern:

```
css
CopyEdit
[provider]-[series]_[model]-[modality]-[outputMethod]-[context].ts

```

> ✅ The [context] and [outputMethod] segments are optional. See their sections for guidance.
> 
> 
> ✅ The `[model]` and `[modality]` segments may be replaced with the tags `models` and `modes` for dynamic services. See below.
> 

---

## 🔠 Components

| Segment | Description | Example |
| --- | --- | --- |
| **provider** | The company or source of the LLM. Use lowercase, no spaces. | `openai`, `anthropic`, `gemini` |
| **series** | The LLM family or series name, indicating a model lineage or generation. | `gpt4o`, `claude`, `gemini` |
| **model** | The specific model or variant name in the series. Use `_` for dots/spaces. | `mini`, `1_5_pro`, `opus` |
| **modality** | The input-output format as `input2output`, describing the data flow. | `text2text`, `text2image`, `audio2text` |
| **outputMethod** *(optional)* | The method of delivering the output. Used when not standard. | `streaming`, `pooling`, `websocket` |
| **context** *(optional)* | Task-specific suffix for hyper-specialized services. | `summarize`, `paraphrase`, `avatar` |

---

## 🧠 New: Dynamic Model and Modality

### 🔁 When to use `models`

Use `models` in place of `[model]` when the service can dynamically switch between models within a series at runtime.

**Example:**

```
CopyEdit
openai-models-text2text.ts

```

This indicates:

- The service supports multiple OpenAI models (e.g., `gpt-3.5`, `gpt-4o`)
- The exact model is selected based on user input or config

### 🔁 When to use `modes`

Use `modes` in place of `[modality]` when the service supports **multiple input-output modalities** dynamically.

**Example:**

```
CopyEdit
gemini-1_5-flash-modes.ts

```

This indicates:

- The service supports `text2text`, `text2image`, or other combinations
- The modality is selected internally or passed by the caller

---

## 🧩 When to Use the Optional [context] Segment

The **[context]** name is **not required** for general-purpose services. For example, an OpenAI GPT model with a `text2text` modality can perform summarization, paraphrasing, and many other tasks by adjusting the prompt dynamically.

Add the **[context]** segment only when:

- The service uses a **special fine-tuned model** dedicated to a specific task (e.g., a summarization-only model)
- The service output is **specifically constrained** to a unique purpose
- You need to **differentiate** between multiple services using the same model and modality

---

## 📤 When to Use the Optional [outputMethod] Segment

The **[outputMethod]** segment is **not required** for standard services that return a simple, immediate response.

Use it **only when**:

- The service uses **non-standard delivery** (streaming, websocket, polling)
- The frontend must **handle the response differently**
- You need to **differentiate** otherwise similar services

---

## 💡 Examples

| Service Name | Description |
| --- | --- |
| `openai-gpt4o_mini-text2text.ts` | Uses OpenAI GPT-4o mini for synchronous text-to-text tasks |
| `openai-models-text2text.ts` | Supports multiple OpenAI models; model selected at runtime |
| `gemini-1_5-flash-modes.ts` | Gemini Flash 1.5 supports multiple modalities |
| `claude-3-sonnet-text2text-streaming.ts` | Claude Sonnet streaming text generation |
| `openai-gpt4o_mini-text2text-summarize.ts` | Specialized service for summarization (fine-tuned or locked prompt) |
| `gemini-models-modes-streaming.ts` | Fully dynamic Gemini service with runtime-chosen model and modality |

---

## 💡 Best Practices

### ✅ 1. Use **kebab-case**, except in `[series]_[model]`

- ✅ `gpt4o_mini` — ✅ not `gpt4o-mini` or `gpt4oMini`

### ✅ 2. Lowercase all names

- Avoid uppercase letters or special characters (except `_` between series/model)

### ✅ 3. Use `input2output` for modality

- ✅ `text2text`, `text2image`, `audio2text`

### ✅ 4. Use `streaming`, `websocket`, etc. only when needed

- Omit `[outputMethod]` for standard synchronous responses

### ✅ 5. Keep `context` short and specific

- ✅ `summarize`, `avatar`, `extract-keywords`

---

## 📁 Recommended Folder Structure

Organize services by output modality or generation method:

```
bash
CopyEdit
$lib/server/services/
├── text2text/
│   └── openai/
│       ├── openai-gpt4o_mini-text2text.ts
│       ├── openai-models-text2text.ts
├── modes/
│   └── gemini/
│       └── gemini-1_5-flash-modes.ts
├── text2image/
│   └── gemini/
│       └── gemini-gemini_1_5_pro-text2image-pooling-avatar.ts

```

---

## 🧩 Parsing and Automation

Split service names by dashes `-`, then further split `[series]_[model]`:

```
ts
CopyEdit
type ServiceNameParts = {
  provider: string;
  series: string;
  model: string; // or "models"
  modality: string; // or "modes"
  outputMethod?: string;
  context?: string;
};

function parseServiceName(name: string): ServiceNameParts {
  const [provider, seriesModel, modality, outputMethod, ...contextParts] = name.split('-');
  const [series, model] = seriesModel.split('_');
  return {
    provider,
    series,
    model,
    modality,
    outputMethod,
    context: contextParts.length ? contextParts.join('-') : undefined
  };
}

```

---

## ✅ Summary

| Rule | Description |
| --- | --- |
| Always use `[provider]-[series]_[model]-[modality]...` | Basic contract |
| Use `models` when model is dynamic | e.g. `openai-models-text2text.ts` |
| Use `modes` when modality is dynamic | e.g. `gemini-1_5-flash-modes.ts` |
| `[context]` and `[outputMethod]` are optional | Use when required for clarity |
| Prefer kebab-case with underscore in series/model | Consistent naming |