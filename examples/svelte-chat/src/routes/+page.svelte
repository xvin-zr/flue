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
			<span class="status">idle</span>
		</div>
		<div class="messages" aria-live="polite">
			<p class="empty">Send a message to begin.</p>
		</div>
		<form>
			<input aria-label="Message" autocomplete="off" disabled placeholder="Say hello" />
			<button disabled type="submit">Send</button>
		</form>
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
