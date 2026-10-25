import type { FlueConversationMessage, FlueConversationPart } from '@flue/sdk';
import { describe, expect, it } from 'vitest';
import { emptyAgentState, reduceAgentEvent } from './agent-reducer.ts';

function userMessage(
	submissionId: string,
	overrides: Partial<FlueConversationMessage> = {},
): FlueConversationMessage {
	return {
		id: `prompt-${submissionId}`,
		role: 'user',
		purpose: 'user',
		display: 'visible',
		submissionId,
		parts: [{ type: 'text', text: 'Build a house', state: 'done' }],
		...overrides,
	};
}

function assistantMessage(
	submissionId: string,
	parts: FlueConversationPart[],
	overrides: Partial<FlueConversationMessage> = {},
): FlueConversationMessage {
	return {
		id: `reply-${submissionId}`,
		role: 'assistant',
		purpose: 'assistant',
		display: 'visible',
		submissionId,
		parts,
		...overrides,
	};
}

describe('reduceAgentEvent status contract', () => {
	it('keeps streaming after a cold observation of an unsettled submission', () => {
		const state = reduceAgentEvent(emptyAgentState, {
			type: 'local_observation',
			phase: 'live',
			conversation: {
				conversationId: 'demo',
				messages: [
					userMessage('submission-1'),
					assistantMessage('submission-1', [{ type: 'text', text: '…', state: 'done' }]),
				],
				settlements: [],
			},
		});
		expect(state.status).toBe('streaming');
		expect(state.historyReady).toBe(true);
	});

	it('returns idle when the observed submission has settled', () => {
		const state = reduceAgentEvent(emptyAgentState, {
			type: 'local_observation',
			phase: 'live',
			conversation: {
				conversationId: 'demo',
				messages: [
					userMessage('submission-1'),
					assistantMessage('submission-1', [{ type: 'text', text: 'done', state: 'done' }]),
				],
				settlements: [{ submissionId: 'submission-1', outcome: 'completed' }],
			},
		});
		expect(state.status).toBe('idle');
	});

	it('exposes before from a bounded observation', () => {
		const state = reduceAgentEvent(emptyAgentState, {
			type: 'local_observation',
			phase: 'live',
			conversation: {
				conversationId: 'demo',
				messages: [userMessage('submission-1')],
				settlements: [{ submissionId: 'submission-1', outcome: 'completed' }],
				before: 'cursor-older',
			},
		});
		expect(state.before).toBe('cursor-older');
		expect(state.status).toBe('idle');
	});

	it('marks submitted while a local send is in flight', () => {
		const state = reduceAgentEvent(emptyAgentState, {
			type: 'local_send_submitted',
			localId: 'local:1',
			message: 'hello',
		});
		expect(state.status).toBe('submitted');
		expect(state.messages).toHaveLength(1);
		expect(state.messages[0]?.id).toBe('local:1');
	});
});
