import {
	type AgentSendResult,
	type ConversationLiveMode,
	createFlueClient,
	type DeliveredAttachment,
	type DeliveredDocumentAttachment,
	type DeliveredImageAttachment,
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
	/**
	 * Hydrate only the newest `limit` messages instead of the whole conversation.
	 * See `AgentConversationObserveOptions.limit` on `@flue/sdk`. When set, the
	 * snapshot's `before` cursor pages older messages via `client.historyBefore()`.
	 */
	readonly limit?: number;
}

export interface UseFlueAgentResult {
	readonly messages: readonly FlueConversationMessage[];
	readonly status: AgentStatus;
	readonly historyReady: boolean;
	readonly error: Error | undefined;
	readonly failedSends: readonly FailedSend[];
	readonly settlements: readonly FlueConversationSettlement[];
	readonly before: string | null | undefined;
	sendMessage(message: string, options?: SendMessageOptions): Promise<AgentSendResult>;
	refresh(): void;
}

export function useFlueAgent(
	getOptions: () => UseFlueAgentOptions = () => ({}),
): UseFlueAgentResult {
	let snapshot = $state.raw<AgentSnapshot>(emptySnapshot);
	let identity: FlueClient | string | undefined;
	let live: ConversationLiveMode = 'sse';
	let limit: number | undefined;
	let session: AgentSession | undefined;
	let unsubscribeSession: (() => void) | undefined;

	$effect(() => {
		const options = getOptions();
		const nextIdentity = options.client ?? options.url;
		const nextLive = options.live ?? 'sse';
		const nextLimit = options.limit;
		if (nextIdentity === identity && nextLive === live && nextLimit === limit) return;

		untrack(() => {
			if (nextIdentity === undefined) {
				const previousSession = session;
				const unsubscribePrevious = unsubscribeSession;
				identity = undefined;
				live = nextLive;
				limit = nextLimit;
				session = undefined;
				unsubscribeSession = undefined;
				snapshot = emptySnapshot;
				unsubscribePrevious?.();
				previousSession?.disposeDetached();
				return;
			}

			const client = options.client ?? createFlueClient({ url: options.url as string });
			const candidate = new AgentSession(client, nextLive, nextLimit);
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
			limit = nextLimit;
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
		get before() {
			return snapshot.before;
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
	AgentSendResult,
	DeliveredAttachment,
	DeliveredDocumentAttachment,
	DeliveredImageAttachment,
	FlueClient,
	FlueConversationMessage,
	FlueConversationPart,
	FlueConversationSettlement,
	PromptUsage,
};
