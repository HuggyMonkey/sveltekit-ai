<script>
  import StreamingTest1 from '$lib/apps/test/StreamingTextStreamerClass.svelte';
  import StreamingTest2 from '$lib/apps/test/StreamingLLMTextChunks.svelte';
  import StructuredOutput from '$lib/apps/test/StructuredOutput.svelte';



</script>

<div class="flex flex-col gap-4">

    <StreamingTest1 />

    <StreamingTest2 />

    <StructuredOutput />

</div>