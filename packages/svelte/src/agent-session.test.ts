import type {
	AgentConversationObservation,
	AgentConversationObservationPhase,
	DeliveredDocumentAttachment,
	FlueClient,
	FlueConversationState,
} from '@flue/sdk';
import { describe, expect, it } from 'vitest';
import { AgentSession } from './agent-session.ts';

function stubClient(overrides: { send?: (options: unknown) => Promise<unknown> } = {}) {
	let phase: AgentConversationObservationPhase = 'loading';
	let conversation: FlueConversationState | undefined;
	const listeners = new Set<() => void>();
	let observeOptions: unknown;
	const observation: AgentConversationObservation = {
		getSnapshot: () => ({ conversation, offset: undefined, phase, error: undefined }),
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		refresh() {},
		close() {},
	};
	const sent: unknown[] = [];
	const client = {
		url: 'https://example.com/agents/assistant/demo',
		observe(options: unknown) {
			observeOptions = options;
			return observation;
		},
		async send(options: unknown) {
			sent.push(options);
			if (overrides.send) return overrides.send(options);
			return {
				submissionId: 'submission-1',
				streamUrl: '/stream',
				offset: '0',
				uid: 'instance-1',
				deduplicated: true,
			};
		},
	} as unknown as FlueClient;
	return {
		client,
		sent,
		getObserveOptions: () => observeOptions,
		publish(next: FlueConversationState) {
			phase = 'live';
			conversation = next;
			for (const listener of listeners) listener();
		},
	};
}

describe('AgentSession', () => {
	it('passes SDK send controls through and returns the full receipt', async () => {
		const source = stubClient();
		const session = new AgentSession(source.client);
		session.start();

		const documents: DeliveredDocumentAttachment[] = [
			{ type: 'document', data: 'cGRm', mimeType: 'application/pdf', filename: 'spec.pdf' },
		];
		const receipt = await session.sendMessage('hello', {
			idempotencyKey: 'key-1',
			uid: 'instance-1',
			documents,
		});

		expect(receipt).toEqual({
			submissionId: 'submission-1',
			streamUrl: '/stream',
			offset: '0',
			uid: 'instance-1',
			deduplicated: true,
		});
		expect(source.sent).toEqual([
			{
				idempotencyKey: 'key-1',
				uid: 'instance-1',
				message: {
					kind: 'user',
					body: 'hello',
					attachments: documents,
				},
			},
		]);
		session.dispose();
	});

	it('keeps sendMessage and refresh identities stable across observations', () => {
		const source = stubClient();
		const session = new AgentSession(source.client);
		session.start();
		const sendMessage = session.sendMessage;
		const refresh = session.refresh;

		source.publish({
			conversationId: 'demo',
			messages: [],
			settlements: [],
		});

		expect(session.sendMessage).toBe(sendMessage);
		expect(session.refresh).toBe(refresh);
		session.dispose();
	});

	it('forwards observe({ limit })', () => {
		const source = stubClient();
		const session = new AgentSession(source.client, 'sse', 50);
		session.start();
		expect(source.getObserveOptions()).toEqual({ live: 'sse', limit: 50 });
		session.dispose();
	});
});
