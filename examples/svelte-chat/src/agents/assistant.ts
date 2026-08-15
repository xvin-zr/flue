'use agent';
import { fauxAssistantMessage, fauxProvider, fauxText } from '@earendil-works/pi-ai';
import { setProvider, useModel } from '@flue/runtime';

const faux = fauxProvider({
	api: 'svelte-chat-example',
	provider: 'svelte-chat-example',
	models: [{ id: 'assistant' }],
});
setProvider(faux.provider);

const echo: Parameters<typeof faux.setResponses>[0][number] = (context) => {
	faux.appendResponses([echo]);
	const input = context.messages.at(-1);
	const text =
		input?.role === 'user'
			? typeof input.content === 'string'
				? input.content
				: input.content.map((block) => (block.type === 'text' ? block.text : '')).join('')
			: '';
	return fauxAssistantMessage(fauxText(`You said: ${text}`));
};
faux.setResponses([echo]);

export function Assistant() {
	useModel('svelte-chat-example/assistant');
	return 'Reply briefly and helpfully.';
}
