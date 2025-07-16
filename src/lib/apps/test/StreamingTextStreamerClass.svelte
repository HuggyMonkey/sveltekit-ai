<script>
  import { TextStreamer } from '$lib/browser/streaming/textStreamer.svelte';

  let input = $state('');

  const streamer = new TextStreamer({
    endpoint: '/api/llm/openai/text2text/streaming',
    typingMode: 'word',
    mode: 'animated',
    speed: 30
  });
</script>

<div class="w-full max-w-xl mx-auto my-6 px-3 py-4 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col gap-4 sm:my-10 sm:p-6 sm:max-w-2xl">
  <div
    class="flex flex-col gap-3 sm:flex-row"
  >
    <input
      type="text"
      bind:value={input}
      placeholder="Type your prompt..."
      class="flex-1 px-3 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400 text-base bg-gray-50"
      autocomplete="off"
      spellcheck="false"
    />
    <div class="flex gap-2 mt-2 sm:mt-0">
      <button
        type="submit"
        onclick={() => streamer.start(input)}
        disabled={streamer.loading || !input.trim()}
        class="px-4 py-2 rounded bg-blue-600 text-white font-medium disabled:bg-blue-300 transition whitespace-nowrap"
        aria-label="Send"
      >
        {streamer.loading ? 'Sending...' : 'Send'}
      </button>
      <button
        type="button"
        onclick={() => streamer.cancel()}
        disabled={!streamer.loading}
        class="px-4 py-2 rounded bg-gray-400 text-white font-medium disabled:bg-gray-200 transition whitespace-nowrap"
        aria-label="Cancel"
      >
        Cancel
      </button>
    </div>
</div>
  {#if streamer.error}
    <div class="text-red-600 text-sm">{streamer.error}</div>
  {/if}
  <div class="relative flex-1 min-h-[120px] max-h-64 overflow-auto bg-gray-900 text-lime-300 rounded p-3 text-base leading-relaxed font-mono break-words whitespace-pre-wrap border border-gray-800">
    {#if streamer.response}
      {streamer.response}
    {:else}
      <span class="text-gray-500">Your streamed text will appear here...</span>
    {/if}
  </div>
</div>