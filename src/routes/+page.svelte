<script lang="ts">
  import { onDestroy } from 'svelte';
  import { streamLLMResponse } from '$lib/browser/streaming/streamingText';

  let query = $state('');
  let responseText = $state('');
  let error: string | null = $state(null);
  let loading = $state(false);

  // Token queue and rendering control
  let tokenQueue: string[] = $state([]);
  let typingInterval: any = $state(null);
  let typingSpeed = $state(30); // ms per token (~33 tokens/sec)

  let controller: AbortController | null = $state(null);

  function startTypingLoop() {
    if (typingInterval) clearInterval(typingInterval);

    typingInterval = setInterval(() => {
      if (tokenQueue.length > 0) {
        const token = tokenQueue.shift();
        if (token) responseText += token;
      } else if (!loading) {
        clearInterval(typingInterval);
        typingInterval = undefined;
      }
    }, typingSpeed);
  }

  async function handleSubmit() {
    controller?.abort(); // Cancel any ongoing stream
    controller = new AbortController();

    // Reset state
    loading = true;
    error = null;
    responseText = '';
    tokenQueue = [];

    await streamLLMResponse({
      query,
      url: '/api/llm/openai/text2text/streaming',
      signal: controller.signal,
      maxRetries: 3,
      onChunk: (chunk) => {
        if (chunk.done) loading = false;
      },
      onToken: (token) => {
        tokenQueue.push(token);
        if (!typingInterval) startTypingLoop(); // kick off renderer
      },
      onError: (errMsg) => {
        error = errMsg;
        loading = false;
        clearInterval(typingInterval);
        typingInterval = undefined;
      },
      onDone: () => {
        loading = false;
      },
    });
  }

  function cancelRequest() {
    controller?.abort();
    clearInterval(typingInterval);
    typingInterval = undefined;
    loading = false;
  }



  onDestroy(() => {
    if (controller) controller.abort();
  });
</script>


<div class="flex flex-col gap-4 p-4"> 
  <textarea class="w-full border border-gray-300 rounded-md p-2" bind:value={query}></textarea>
  <button class="bg-blue-500 text-white px-4 py-2 rounded-md" onclick={handleSubmit} disabled={loading}>Submit</button>
  <button class="bg-red-500 text-white px-4 py-2 rounded-md" onclick={cancelRequest} disabled={!loading}>Cancel</button>
</div>

{#if loading}
  <p class="text-sm text-gray-500">Streaming...</p>
{/if}

{#if error}
  <p class="text-red-600">{error}</p>
{/if}

<pre class="mt-4">{responseText}</pre>


{#if error}
  <div class="error">{error}</div>
{/if} 

<style>
  .response-box {
    min-height: 120px;
    border: 1px solid #ccc;
    padding: 1rem;
    margin-top: 1rem;
    background: #fafafa;
    font-family: monospace;
    white-space: pre-wrap;
  }
  .error {
    color: #b00;
    margin-top: 1rem;
  }
</style>