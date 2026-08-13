import {
	type ConversationLiveMode,
	createFlueClient,
	type DeliveredAttachment,
	type FlueClient,
	type FlueConversationMessage,
	type FlueConversationPart,
	type FlueConversationSettlement,
	type PromptUsage,
} from '@flue/sdk';
import { onDestroy, untrack } from 'svelte';
import {
	type AgentSnapshot,
	type AgentStatus,
	emptyAgentState,
	type FailedSend,
} from './agent-reducer.ts';
import { AgentSession, type SendMessageOptions } from './agent-session.ts';

const emptySnapshot: AgentSnapshot = {
	messages: emptyAgentState.messages,
	status: 'idle',
	historyReady: false,
	error: undefined,
	failedSends: emptyAgentState.failedSends,
	settlements: emptyAgentState.settlements,
};

export interface UseFlueAgentOptions {
	readonly url?: string;
	readonly client?: FlueClient;
	readonly live?: ConversationLiveMode;
}

export interface UseFlueAgentResult {
	readonly messages: readonly FlueConversationMessage[];
	readonly status: AgentStatus;
	readonly historyReady: boolean;
	readonly error: Error | undefined;
	readonly failedSends: readonly FailedSend[];
	readonly settlements: readonly FlueConversationSettlement[];
	sendMessage(message: string, options?: SendMessageOptions): Promise<void>;
	refresh(): void;
}

export function useFlueAgent(
	getOptions: () => UseFlueAgentOptions = () => ({}),
): UseFlueAgentResult {
	let snapshot = $state.raw<AgentSnapshot>(emptySnapshot);
	let identity: FlueClient | string | undefined;
	let live: ConversationLiveMode = 'sse';
	let session: AgentSession | undefined;
	let unsubscribeSession: (() => void) | undefined;

	$effect(() => {
		const options = getOptions();
		const nextIdentity = options.client ?? options.url;
		const nextLive = options.live ?? 'sse';
		if (nextIdentity === identity && nextLive === live) return;

		untrack(() => {
			if (nextIdentity === undefined) {
				const previousSession = session;
				const unsubscribePrevious = unsubscribeSession;
				identity = undefined;
				live = nextLive;
				session = undefined;
				unsubscribeSession = undefined;
				snapshot = emptySnapshot;
				unsubscribePrevious?.();
				previousSession?.disposeDetached();
				return;
			}

			const client = options.client ?? createFlueClient({ url: options.url as string });
			const candidate = new AgentSession(client, nextLive);
			let candidateSnapshot = candidate.getSnapshot();
			let committed = false;
			const unsubscribeCandidate = candidate.subscribe(() => {
				candidateSnapshot = candidate.getSnapshot();
				if (committed && session === candidate) snapshot = candidateSnapshot;
			});
			try {
				candidate.start();
			} catch (error) {
				unsubscribeCandidate();
				throw error;
			}

			const previousSession = session;
			const unsubscribePrevious = unsubscribeSession;
			identity = nextIdentity;
			live = nextLive;
			session = candidate;
			unsubscribeSession = unsubscribeCandidate;
			snapshot = candidateSnapshot;
			committed = true;
			unsubscribePrevious?.();
			previousSession?.disposeDetached();
		});
	});

	onDestroy(() => {
		try {
			session?.dispose();
		} finally {
			unsubscribeSession?.();
		}
	});

	return {
		get messages() {
			return snapshot.messages;
		},
		get status() {
			return snapshot.status;
		},
		get historyReady() {
			return snapshot.historyReady;
		},
		get error() {
			return snapshot.error;
		},
		get failedSends() {
			return snapshot.failedSends;
		},
		get settlements() {
			return snapshot.settlements;
		},
		async sendMessage(message, options) {
			if (!session) throw new Error('useFlueAgent() cannot send without a conversation url');
			return session.sendMessage(message, options);
		},
		refresh() {
			session?.refresh();
		},
	};
}

export type { AgentStatus, FailedSend } from './agent-reducer.ts';
export type { SendMessageOptions } from './agent-session.ts';
export type {
	DeliveredAttachment,
	FlueClient,
	FlueConversationMessage,
	FlueConversationPart,
	FlueConversationSettlement,
	PromptUsage,
};
