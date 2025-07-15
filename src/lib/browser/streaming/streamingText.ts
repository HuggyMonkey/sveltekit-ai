
type LLMChunk = { text?: string; done?: boolean };
type StreamOptions = {
  query: string;
  url: string;
  signal?: AbortSignal;
  onChunk: (chunk: LLMChunk) => void;
  onError: (errMsg: string) => void;
  onDone?: () => void;
  onToken?: (token: string, elapsed: number) => void;
  maxRetries?: number;
};

export async function streamLLMResponse({
  query,
  url,
  signal,
  onChunk,
  onError,
  onDone,
  onToken,
  maxRetries = 3,
}: StreamOptions) {
  const decoder = new TextDecoder();
  let retryCount = 0;

  async function attemptStream(retryDelay = 500) {
    let buffer = '';
    const startTime = performance.now();

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let eventIdx;
        while ((eventIdx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, eventIdx).trim();
          buffer = buffer.slice(eventIdx + 2);

          if (!rawEvent || rawEvent.startsWith(':')) continue;

          if (rawEvent.startsWith('event: error')) {
            const dataIdx = rawEvent.indexOf('data:');
            if (dataIdx !== -1) {
              try {
                const err = JSON.parse(rawEvent.slice(dataIdx + 5).trim());
                onError(err.message || 'Stream error');
              } catch {
                onError('Stream error (malformed JSON)');
              }
            }
            return;
          }

          if (rawEvent.startsWith('data:')) {
            const json = rawEvent.slice(5).trim();
            try {
              const chunk: LLMChunk = JSON.parse(json);
              onChunk(chunk);

              // Track timing per token
              if (chunk.text && onToken) {
                for (const token of chunk.text) {
                  const now = performance.now();
                  const elapsed = now - startTime;
                  onToken(token, elapsed);
                }
              }

              if (chunk.done) {
                onDone?.();
                return;
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      }

      onDone?.();
    } catch (err: any) {
      const isRetryable =
        err.name === 'AbortError' ||
        err.message === 'No response body' ||
        err.message.startsWith('HTTP 5');

      if (retryCount < maxRetries && isRetryable) {
        retryCount++;
        const backoff = retryDelay * 2 ** retryCount;
        console.warn(`Retrying stream in ${backoff}ms... (${retryCount})`);
        await new Promise((r) => setTimeout(r, backoff));
        return attemptStream(retryDelay);
      }

      onError(err?.message || 'Streaming failed');
    }
  }

  await attemptStream();
}
