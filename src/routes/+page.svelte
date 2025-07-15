<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<button class="bg-blue-500 text-white p-2 rounded-md" onclick={() => {
  fetch('/api/llm/openai/text2text', {
    method: 'POST',
    body: JSON.stringify({ query: 'What is the capital of Saint Lucia?' })
  })
}}>
  Test
</button>