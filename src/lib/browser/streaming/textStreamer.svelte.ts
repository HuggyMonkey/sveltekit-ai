
export function exponentialJitterBackoff(attempt: number, base = 500, max = 10000): number {
    const exponential = base * 2 ** attempt;
    const jitter = Math.random() * base;
    return Math.min(exponential + jitter, max);
  }


export type TypingMode = 'char' | 'word' | 'sentence';
export type StreamMode = 'animated' | 'stream';

export interface TextStreamerConfig {
  endpoint: string;
  typingMode?: TypingMode;
  mode?: StreamMode;
  speed?: number;
  maxRetries?: number;
  onStart?: () => void;
  onToken?: (token: string) => void;
  onComplete?: () => void;
  onRetry?: (attempt: number, delay: number) => void;
  onError?: (message: string) => void;
}

export class TextStreamer {
  // Config
  endpoint: string;
  typingMode: TypingMode;
  mode: StreamMode;
  speed: number;
  maxRetries: number;

  // Reactive state
  response = $state('');
  loading = $state(false);
  error = $state<string | null>(null);
  retryInfo = $state<string | null>(null);
  isRetrying = $state(false);
  lastAbortReason = $state<string | null>(null);

  // Lifecycle hooks
  private onStart?: () => void;
  private onToken?: (token: string) => void;
  private onComplete?: () => void;
  private onRetry?: (attempt: number, delay: number) => void;
  private onError?: (message: string) => void;

  // Internal state
  private controller?: AbortController;
  private queue: string[] = [];
  private timer: any = null;

  constructor(config: TextStreamerConfig) {
    const {
      endpoint,
      typingMode = 'word',
      mode = 'animated',
      speed = 80,
      maxRetries = 3,
      onStart,
      onToken,
      onComplete,
      onRetry,
      onError,
    } = config;

    this.endpoint = endpoint;
    this.typingMode = typingMode;
    this.mode = mode;
    this.speed = speed;
    this.maxRetries = maxRetries;

    this.onStart = onStart;
    this.onToken = onToken;
    this.onComplete = onComplete;
    this.onRetry = onRetry;
    this.onError = onError;
  }

  private tokenize(text: string): string[] {
    if (this.typingMode === 'char') return text.split('');
    if (this.typingMode === 'word') return text.match(/\S+\s*/g) ?? [];
    return text.match(/[^.!?]+[.!?]|\s+|.+$/g) ?? [];
  }

  private processQueue = () => {
    if (this.queue.length) {
      const token = this.queue.shift()!;
      this.response += token;
      this.onToken?.(token);
      this.timer = setTimeout(this.processQueue, this.speed);
    } else {
      this.timer = null;
      this.onComplete?.();
    }
  };

  private enqueue(token: string) {
    this.queue.push(token);
    if (!this.timer) this.processQueue();
  }

  private parseSSEChunks(buffer: string): { type: 'data' | 'error'; payload: any }[] {
    const chunks: { type: 'data' | 'error'; payload: any }[] = [];
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!raw || raw.startsWith(':')) continue;

      if (raw.startsWith('event: error')) {
        const dataIndex = raw.indexOf('data:');
        if (dataIndex !== -1) {
          try {
            const err = JSON.parse(raw.slice(dataIndex + 5).trim());
            chunks.push({ type: 'error', payload: err });
          } catch {
            chunks.push({ type: 'error', payload: { message: 'Malformed stream error' } });
          }
        }
      } else if (raw.startsWith('data:')) {
        try {
          const chunk = JSON.parse(raw.slice(5).trim());
          chunks.push({ type: 'data', payload: chunk });
        } catch {
          // skip malformed chunk
        }
      }
    }
    return chunks;
  }

  async start(query: string) {
    if (this.loading) this.cancel();
    this.response = '';
    this.error = this.retryInfo = this.lastAbortReason = null;
    this.loading = true;
    this.onStart?.();
    this.controller = new AbortController();

    const decoder = new TextDecoder();
    let buffer = '';
    let retries = 0;

    const attempt = async () => {
      try {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: this.controller!.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = this.parseSSEChunks(buffer);
          for (const { type, payload } of chunks) {
            if (type === 'error') throw new Error(payload.message);
            if (payload?.text) {
              if (this.mode === 'stream') {
                this.response += payload.text;
                this.onToken?.(payload.text);
              } else {
                this.tokenize(payload.text).forEach((t) => this.enqueue(t));
              }
            }
            if (payload?.done) {
              this.loading = false;
              this.onComplete?.();
              return;
            }
          }
        }

        this.loading = false;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          this.lastAbortReason = 'User cancelled';
          return;
        }

        const retryable =
          err.message.startsWith('HTTP 5') || err.message === 'No response body';

        if (retries < this.maxRetries && retryable) {
          const delay = exponentialJitterBackoff(retries);
          retries++;
          this.isRetrying = true;
          this.retryInfo = `Retry ${retries} in ${delay} ms...`;
          this.onRetry?.(retries, delay);
          await new Promise((r) => setTimeout(r, delay));
          this.retryInfo = null;
          this.isRetrying = false;
          return attempt();
        }

        this.error = err.message;
        this.loading = false;
        this.onError?.(err.message);
      }
    };

    await attempt();
  }

  cancel() {
    this.controller?.abort();
    this.loading = false;
    this.lastAbortReason = 'Manually aborted';
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
  }

  destroy() {
    this.cancel();
    this.error = this.retryInfo = null;
  }
}