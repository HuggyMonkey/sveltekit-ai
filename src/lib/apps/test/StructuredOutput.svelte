<script>
    let topic = $state('');
    let loading = $state(false);
    let error = $state('');
    
  
    // @ts-ignore
    let relatedItems = $state([]) 

    async function fetchRelatedItems() {
        error = '';
        relatedItems = []
        loading = true;
        try {
            const res = await fetch('/api/llm/openai/text2text/structuredOutputs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: topic })
            });
            const data = await res.json();
            if (!data.success) {
                error = data.error?.message || 'Unknown error';
            } else {
                relatedItems = data.data.relatedItems;
                console.log(relatedItems);
            }
        } catch (e) {
            error = 'Network or server error';
        } finally {
            loading = false;
        }
    }
</script>

<div class="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow flex flex-col gap-4 mb-7">
    <h2 class="text-xl font-bold mb-2">Related Words Finder</h2>
    <div
        class="flex flex-col gap-3"
       
    >
        <input
            class="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            type="text"
            placeholder="Enter a topic word"
            bind:value={topic}
            required
            maxlength="50"
        />
        <button
        onclick={fetchRelatedItems}
            class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
            type="submit"
            disabled={loading || !topic.trim()}
        >
            {#if loading}
                <span class="animate-spin mr-2 inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                Finding...
            {:else}
                Find Related Words
            {/if}
        </button>
    </div>

    {#if error}
        <div class="text-red-600 text-sm">{error}</div>
    {/if}

    {#if relatedItems}
        <div class="mt-4">
            <h3 class="font-semibold mb-2">Related Words:</h3>
            <ul class="list-disc list-inside space-y-1">
                {#each relatedItems as item}
                    <li>{item.name}</li>
                {/each}
            </ul>
        </div>
    {/if}
</div>