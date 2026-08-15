<script lang="ts">
	import { useFlueAgent } from '@flue/svelte';
	import { onMount } from 'svelte';

	let conversationId = $state<string>();
	let input = $state('');
	let localError = $state<string>();
	let draftRevision = 0;

	const agent = useFlueAgent(() => ({
		url:
			conversationId === undefined
				? undefined
				: `/api/agents/assistant/${conversationId}`,
	}));
	let visibleMessages = $derived(
		agent.messages.filter((message) => message.display === 'visible'),
	);

	onMount(() => {
		conversationId = crypto.randomUUID();
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const message = input.trim();
		if (!message) return;

		const submittedRevision = draftRevision;
		input = '';
		localError = undefined;
		try {
			await agent.sendMessage(message);
		} catch (error) {
			localError = error instanceof Error ? error.message : String(error);
			if (draftRevision === submittedRevision && input === '') input = message;
		}
	}
</script>

<svelte:head>
	<title>Flue Svelte chat</title>
	<meta
		name="description"
		content="A SvelteKit example for durable Flue conversations and background actions."
	/>
</svelte:head>

<main>
	<header>
		<p class="eyebrow">Flue Svelte hooks</p>
		<h1>Durable chat and background actions</h1>
	</header>

	<section>
		<div class="section-heading">
			<h2>Agent chat</h2>
			<span class="status {agent.status}">{agent.status}</span>
		</div>
		<div class="messages" aria-live="polite">
			{#if visibleMessages.length === 0}
				<p class="empty">Send a message to begin.</p>
			{/if}
			{#each visibleMessages as message (message.id)}
				<article class="message {message.role}">
					<strong>{message.role}</strong>
					{#each message.parts as part (part)}
						{#if part.type === 'text'}
							<p>{part.text}</p>
						{/if}
					{/each}
				</article>
			{/each}
		</div>
		<form onsubmit={submit}>
			<input
				aria-label="Message"
				autocomplete="off"
				bind:value={input}
				oninput={() => (draftRevision += 1)}
				placeholder="Say hello"
			/>
			<button disabled={conversationId === undefined || !input.trim()} type="submit">Send</button>
		</form>
		{#if localError}
			<p class="error" role="alert"><strong>Send failed:</strong> {localError}</p>
		{/if}
		{#if agent.error}
			<p class="error" role="alert"><strong>Agent error:</strong> {agent.error.message}</p>
		{/if}
	</section>

	<section>
		<div class="section-heading">
			<h2>Demo agent (background action)</h2>
			<span class="status">idle</span>
		</div>
		<button disabled type="button">Run demo action</button>
		<div class="messages" aria-live="polite">
			<p class="empty">The demo conversation appears here.</p>
		</div>
	</section>
</main>
