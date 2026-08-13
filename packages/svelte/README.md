# `@flue/svelte`

Svelte 5 reactive state for one durable Flue conversation. `@flue/svelte` maintains UI state; `@flue/sdk` handles HTTP and Durable Streams transport.

```sh
pnpm add @flue/svelte @flue/sdk
```

Requires Svelte 5.3 or later. For a working chat, see the [Svelte and SvelteKit guide](https://flueframework.com/docs/guide/svelte/).

## `useFlueAgent()`

`useFlueAgent()` observes one agent conversation. Its URL is the route where the application's `app.ts` mounts an agent (`app.route('/agents/triage', createAgentRouter(Triage))`) plus a caller-chosen conversation id. A fresh id starts a new durable conversation when its first prompt is admitted.

Call it during component initialization with a synchronous, side-effect-free options getter:

```svelte
<script lang="ts">
  import { useFlueAgent } from '@flue/svelte';

  let { conversationId }: { conversationId?: string } = $props();
  const agent = useFlueAgent(() => ({
    url: conversationId ? `/api/agents/triage/${conversationId}` : undefined,
  }));
</script>

<p>{agent.status}</p>
```

```ts
function useFlueAgent(getOptions?: () => UseFlueAgentOptions): UseFlueAgentResult;

interface UseFlueAgentOptions {
  readonly url?: string;
  readonly client?: FlueClient;
  readonly live?: 'sse' | 'long-poll';
}
```

`useFlueAgent` accepts only the getter, not an options object or a store. Omitting the getter, or returning neither a defined `client` nor `url`, keeps the invocation dormant. An empty-string URL is still an active identity and follows the SDK's URL validation behavior.

| Option   | Description                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`    | Conversation URL (agent mount URL plus conversation id). Relative URLs resolve against the browser origin.                                                                  |
| `client` | A preconfigured `createFlueClient({ url, headers, token, fetch })` client. It takes precedence over `url`; URL changes are ignored while the same client remains effective. |
| `live`   | Live update mode. Defaults to `'sse'`; use `'long-poll'` to disable SSE.                                                                                                    |

A fresh options object does not reconnect. A change to the effective URL string, client reference, or live mode replaces the observation. Keep a custom client's identity stable for as long as its URL and authentication inputs are unchanged:

```svelte
<script lang="ts">
  import { useFlueAgent } from '@flue/svelte';
  import { createFlueClient } from '@flue/sdk';

  let { conversationId, token }: { conversationId: string; token: string } = $props();
  const client = $derived(
    createFlueClient({
      url: `/api/agents/triage/${conversationId}`,
      token,
    }),
  );
  const agent = useFlueAgent(() => ({ client }));
</script>
```

The adapter does not dispose a supplied client. It owns only the observation it creates from that client.

## Result

`useFlueAgent()` returns one stable plain object:

```ts
interface UseFlueAgentResult {
  readonly messages: readonly FlueConversationMessage[];
  readonly status: AgentStatus;
  readonly historyReady: boolean;
  readonly error: Error | undefined;
  readonly failedSends: readonly FailedSend[];
  readonly settlements: readonly FlueConversationSettlement[];
  sendMessage(message: string, options?: SendMessageOptions): Promise<void>;
  refresh(): void;
}

interface FailedSend {
  id: string;
  message: string;
  error: Error;
}

interface SendMessageOptions {
  images?: DeliveredAttachment[];
}

type AgentStatus = 'idle' | 'connecting' | 'submitted' | 'streaming' | 'error';
```

| Property       | Description                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `messages`     | Canonical messages plus pending or failed optimistic user messages, in render order.                                                                                     |
| `status`       | Current connection or locally attributable operation state.                                                                                                              |
| `historyReady` | `true` after a materialized history snapshot loads or the SDK confirms that the conversation is absent. It remains true through later reconnects.                        |
| `error`        | The current asynchronous observation, send-admission, or attributable settlement error. Lifecycle errors propagate instead; see [SSR and lifecycle](#ssr-and-lifecycle). |
| `failedSends`  | Admission failures, each correlated with its retained optimistic message by `id`. A later send clears prior failed-send and error state.                                 |
| `settlements`  | Canonical terminal outcomes observed for all tracked submissions in the conversation.                                                                                    |
| `sendMessage`  | Optimistically adds and admits a user prompt.                                                                                                                            |
| `refresh`      | Re-runs history catch-up for the active observation.                                                                                                                     |

The object and both method identities stay stable across publications and conversation replacements. The methods target the currently committed conversation when called.

### Status

| Status       | Meaning                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| `idle`       | No locally attributable prompt is active, or the adapter is dormant.                                            |
| `connecting` | Initial history or a live reconnection is in progress. `error` may hold the latest retryable transport failure. |
| `submitted`  | A local prompt is being admitted or has not yet produced attributable assistant activity.                       |
| `streaming`  | Assistant activity for a local submission is arriving or awaits settlement.                                     |
| `error`      | Observation, prompt admission, or an attributable local submission failed.                                      |

An unrelated remote settlement does not put this invocation into `error`; it remains available in `settlements`.

## Reactivity and ownership

Read properties directly from the stable result so Svelte tracks their getter reads:

```svelte
<p>{agent.status}</p>
{#each agent.messages as message (message.id)}
  <p>{message.role}</p>
{/each}
```

Ordinary destructuring or spreading reads the properties once and creates a snapshot:

```ts
const { messages } = agent; // not kept reactive
const snapshot = { ...agent }; // not kept reactive
```

The result properties and their arrays are shallowly read-only. Nested SDK messages, parts, metadata, and errors are not frozen or deeply proxied.

Each `useFlueAgent()` invocation owns an independent observation for its component lifetime, even when two invocations address the same URL. Pass one returned object through props or context to share that invocation; call `useFlueAgent()` again to create another.

## Sending and reconciliation

### `sendMessage()`

```ts
await agent.sendMessage('Describe this image.', {
  images: [
    {
      type: 'image',
      data: base64Bytes,
      mimeType: 'image/png',
      filename: 'diagram.png',
    },
  ],
});
```

`images` accepts SDK `DeliveredAttachment` values. Images are the current attachment type.

A send immediately appends an optimistic visible user message containing the exact text and local `data:` URLs for image previews. The promise resolves when the server admits the prompt (HTTP 202), not when generation completes. Follow `status`, messages, or `settlements` for later work.

The observed conversation remains canonical:

- The canonical user message replaces its optimistic echo while retaining the local message `id`, so a row keyed by `message.id` does not flicker.
- Assistant messages retain their canonical ids, including multiple assistant messages associated with one submission.
- Concurrent sends reconcile independently when admissions, messages, and settlements arrive out of order.
- A canonical message or settlement removes its corresponding pending optimistic echo.

If admission rejects, `sendMessage()` rejects with the original thrown value. The adapter retains the optimistic message, records a normalized `Error` in `error`, adds `{ id, message, error }` to `failedSends`, and sets `status` to `error`. Application code can restore input or offer retry by calling `sendMessage()` again. A later send first clears stale failed-send and error state.

Calling `sendMessage()` while dormant rejects with `useFlueAgent() cannot send without a conversation url`. Stopping observation does not cancel an admitted prompt or a send already pending; durable server work continues.

### `refresh()`

`refresh()` re-runs history catch-up and resumes live updates for the active conversation. It is useful when an absent conversation may be created out of band by a webhook, queue worker, or server-side wakeup. A successful send admitted while the observation is absent refreshes automatically.

Calling `refresh()` while dormant is a no-op. The application chooses any schedule or UI for additional refreshes.

## History and live updates

The adapter publishes the initial materialized history as one coherent transcript, then follows updates from its exact checkpoint. `historyReady` becomes `true` after history loads or absence is confirmed. During a reconnect, known messages and local activity remain visible, `connecting` exposes the retryable error, and successful recovery clears it.

Live updates default to SSE. Pass `live: 'long-poll'` for offset-resumed polling. Transport reconnection, backoff, replay, canonical resets, and at-least-once deduplication belong to `@flue/sdk`; the adapter reduces the SDK's maintained observation into Svelte state.

There is no `stop()` method. Observation ownership follows the component lifetime, and stopping browser observation does not cancel durable server work.

## Messages

`messages` contains SDK `FlueConversationMessage` values:

```ts
interface FlueConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  purpose: 'user' | 'assistant' | 'dispatch' | 'advisory';
  display: 'visible' | 'hidden' | 'diagnostic';
  submissionId?: string;
  turnId?: string;
  signal?: { tagName?: string; attributes?: Record<string, string> };
  settlement?: { outcome: 'failed' | 'aborted' };
  parts: FlueConversationPart[];
  metadata?: Record<string, unknown>;
}
```

Use `display` to choose a transcript lane and `id` to key rendered rows. Message metadata is entirely agent-authored through `useResponseStart` and `useResponseFinish`; values such as timestamps, usage, or model names exist only when the application attaches them.

Every current part family is exposed unchanged:

```ts
type FlueConversationPart =
  | { type: 'text'; text: string; state: 'streaming' | 'done' }
  | { type: 'reasoning'; text: string; state: 'streaming' | 'done' }
  | { type: `data-${string}`; data: unknown }
  | {
      type: 'file';
      mediaType: string;
      id?: string;
      size?: number;
      url?: string;
      filename?: string;
    }
  | ({ type: 'dynamic-tool'; toolName: string; toolCallId: string } & (
      | { state: 'input-available'; input: unknown }
      | {
          state: 'output-available';
          input: unknown;
          output: unknown;
          durationMs?: number;
        }
      | {
          state: 'output-error';
          input: unknown;
          errorText: string;
          durationMs?: number;
        }
    ));
```

- **Text and reasoning** carry materialized text and a `streaming` or `done` state.
- **Named data** uses a `data-<name>` type and stores the `useDataWriter()` payload on `data`.
- **Dynamic tools** identify the tool and call, expose the input immediately, then add an output or error and optional handler duration.
- **Files** describe the media and optional durable id, byte size, URL, and filename. Optimistic images use a local `data:` URL; canonical files use the ready-to-use URL resolved by the SDK when available.

## Settlements

```ts
interface FlueConversationSettlement {
  submissionId: string;
  outcome: 'completed' | 'failed' | 'aborted';
  error?: unknown;
  answeredBySubmissionId?: string;
}
```

`settlements` mirrors the canonical observation. `submissionId` correlates a terminal outcome with messages and local admissions. `answeredBySubmissionId` identifies the host submission whose coalesced response answered this one, when available. Only a failed settlement attributable to current local activity drives `agent.error`; completed, aborted, and unrelated remote outcomes remain programmatic data.

## SSR and lifecycle

During SSR and before the browser effect runs, the exact result is:

```ts
{
  messages: [],
  status: 'idle',
  historyReady: false,
  error: undefined,
  failedSends: [],
  settlements: [],
}
```

SSR does not evaluate the options getter, construct a URL client, observe, or access browser state. Activation begins after mount. Use `@flue/sdk` directly for server-side `history()`, `read()`, or other server reads.

Effective-identity changes are transactional. URL-client construction, `observe()`, subscription, and synchronous initial publication must all succeed before a candidate replaces the committed conversation. On failure, reachable candidate resources are rolled back and the prior committed conversation remains usable. The original synchronous value propagates through Svelte; it is not stored in `agent.error`.

The adapter does not retry activation or keep failed-identity state. Reset a `<svelte:boundary>` or remount the component to retry, including for the same identity. This is separate from SDK transport reconnection after an observation has activated.

After a successful replacement, the new observation is committed before the old one is cleaned up. A cleanup failure does not undo the replacement. Entering dormancy similarly commits the exact dormant result and detaches old publications before cleanup. Replacement and dormancy cleanup attempt both unsubscribe and close, then propagate the first thrown value unchanged; cleanup failures never enter `agent.error` and are not retried.

Component destruction does not publish dormancy: the committed identity, method target, and publication path remain current while disposal runs. Disposal marks the observation inactive, then unsubscribes and closes it; if unsubscribe throws, close is skipped. The listener remains attached during disposal and is removed afterward whether disposal succeeds or throws, so synchronous reentrant calls and publications follow the still-committed conversation while cleanup runs. The original cleanup failure propagates unchanged and disposal is not retried. No result or method behavior is promised after the component's lifetime. Cleanup does not dispose a supplied client and does not cancel admitted server work.

## Re-exported types

Package-owned types:

- `UseFlueAgentOptions`
- `UseFlueAgentResult`
- `AgentStatus`
- `FailedSend`
- `SendMessageOptions`

SDK type re-exports:

- `DeliveredAttachment`
- `FlueClient`
- `FlueConversationMessage`
- `FlueConversationPart`
- `FlueConversationSettlement`
- `PromptUsage`

See the [Svelte and SvelteKit guide](https://flueframework.com/docs/guide/svelte/), the [FlueClient reference](https://flueframework.com/docs/sdk/flue-client/), and the runnable [`examples/svelte-chat`](https://github.com/withastro/flue/tree/main/examples/svelte-chat).
