# Developer Guide: API Route Structure for LLM Services

## Purpose

This guide defines the standardized folder structure, naming conventions, and best practices for creating API routes that expose LLM inferencing services via HTTP endpoints in your SvelteKit application.

---

## ✅ Design Principles

- Each API route should **map 1:1 to a service** in `$lib/server/services`.
- The route structure should mirror the **LLM naming convention** for discoverability.
- API routes must remain **thin**, focusing only on request parsing and delegating logic to services.
- The structure must support **dynamic models**, **modalities**, **streaming**, and **specialized contexts**.

---

## 📂 Folder Structure Overview

```

src/routes/api/
└── llm/
    ├── [provider]/
    │   ├── [modality]/                         # text2text, image2text, modes (dynamic)
    │   │   ├── +server.ts                      # Standard route (e.g. POST /llm/openai/text2text)
    │   │   ├── streaming/+server.ts            # Streaming endpoint (optional)
    │   │   └── summarize/+server.ts            # Context-specific endpoint (optional)
    │   └── models/+server.ts                   # Dynamic model selection endpoint

```

---

## 🔤 Route Naming Convention

Each route corresponds to a filename or folder using the following pattern:

```

/api/llm/[provider]/[modality]/[outputMethod|context]?

```

| Segment | Description |
| --- | --- |
| **provider** | The LLM provider (e.g. `openai`, `anthropic`, `gemini`) |
| **modality** | Input-output type (e.g. `text2text`, `image2text`, or `modes` if dynamic) |
| **outputMethod** *(optional)* | Used for streaming, polling, websocket, etc. |
| **context** *(optional)* | Used for hyper-specific endpoints (e.g. `summarize`, `avatar`) |

---

## 🧱 Route Implementation Example

### Service:

```

$lib/server/services/text2text/openai/openai-gpt4o_mini-text2text.ts

```

### API Route:

```

// src/routes/api/llm/openai/text2text/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openai_gpt4o_mini_text2text } from '$lib/server/services/text2text/openai/openai-gpt4o_mini-text2text';

export const POST: RequestHandler = async ({ request }) => {
  const input = await request.json();
  const result = await openai_gpt4o_mini_text2text(input);
  return json(result);
};

```

---

## 🧩 When to Create Subroutes

### ✅ Create subfolders like `streaming/` or `summarize/` when:

- The service has a **specialized output method**
- The service is **context-specific** (e.g. summarization only)
- You want to expose **different handlers** for the same base model/modality

Each should have its own `+server.ts` file to handle that request specifically.

---

## 🌀 Dynamic Model or Modality Example

### Service:

```
bash
$lib/server/services/text2text/openai/openai-models-text2text.t

```

### API Route:

```

// src/routes/api/llm/openai/text2text/+server.ts
import { openai_models_text2text } from '$lib/server/services/text2text/openai/openai-models-text2text';

```

Or for dynamic modalities:

```

$lib/server/services/modes/gemini/gemini-1_5-flash-modes.ts

```

```

// src/routes/api/llm/gemini/modes/+server.ts
import { gemini_1_5_flash_modes } from '$lib/server/services/modes/gemini/gemini-1_5-flash-modes';

```

---

## 🧪 Best Practices

| Rule | Explanation |
| --- | --- |
| Thin route handlers | Logic should stay in `services/`, not the API route |
| Match folder names to service names | Keeps routing and code structure consistent |
| Use POST only | All inference endpoints should be POST for security and clarity |
| Validate request shape | Let the service handle validation using `zod` |
| Return `json(result)` | Always return a consistent response object `{ success, data |
| Export `Input` and `Output` types | Let routes optionally type input/output with imports from the service |

---

```
routes/api/llm/openai/text2text/+server.ts
```

---

## 🧼 Suggested File Template

```
// src/routes/api/llm/[provider]/[modality]/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { service } from '$lib/server/services/[modality]/[provider]/[service-name]';

export const POST: RequestHandler = async ({ request }) => {
  const input = await request.json();
  const result = await service(input);
  return json(result);
};

```

---

## 🧠 Summary

| Element | Rule |
| --- | --- |
| File placement | `src/routes/api/llm/[provider]/[modality]/[optional]/+server.ts` |
| Matches service | 1:1 mapping to `$lib/server/services/…` |
| Route responsibilities | Parse JSON, call service, return `json()` |
| OutputMethod/Context | Use folders for streaming or context-specific endpoints |
| Dynamic handling | Use `models` or `modes` in service name + API path |
| Folder naming | Consistent with service file naming convention |