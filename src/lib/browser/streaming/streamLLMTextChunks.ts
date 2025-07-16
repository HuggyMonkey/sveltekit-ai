export interface StreamOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/**
 * Async generator that yields LLM-generated text chunks from a streaming endpoint.
 *
 * @param url - The streaming LLM API endpoint
 * @param query - The input prompt or query
 * @param options - Optional fetch settings (e.g., signal, headers)
 * @yields string - Each text chunk as it's streamed
 */
export async function* streamLLMTextChunks(
  url: string,
  query: string,
  options: StreamOptions = {}
): AsyncGenerator<string> {
  const { signal, headers = {} } = options;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ query }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`LLM stream failed with status ${res.status}`);
  }

  if (!res.body) {
    throw new Error('LLM stream failed: missing response body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);

      if (!raw || raw.startsWith(':')) continue;

      if (raw.startsWith('event: error')) {
        const di = raw.indexOf('data:');
        if (di !== -1) {
          try {
            const errorData = JSON.parse(raw.slice(di + 5).trim());
            throw new Error(errorData.message || 'LLM stream error');
          } catch {
            throw new Error('Malformed stream error');
          }
        }
      }

      if (raw.startsWith('data:')) {
        try {
          const chunk = JSON.parse(raw.slice(5).trim());
          if (chunk?.text) {
            yield chunk.text;
          }
        } catch(e) {
          // Log malformed chunks for debugging
          console.warn('Malformed LLM stream chunk ignored:', e);
        }
      }
    }
  }

  // Process any remaining data in the buffer after the stream ends
  if (buffer.trim()) {
    const raw = buffer.trim();
    if (raw.startsWith('data:')) {
      try {
        const chunk = JSON.parse(raw.slice(5).trim());
        if (chunk?.text) {
          yield chunk.text;
        }
      } catch (e) {
        console.warn('Malformed final LLM stream chunk ignored:', e);
      }
    }
  }
}
