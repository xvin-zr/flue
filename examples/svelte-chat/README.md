# Svelte chat example

A prerendered SvelteKit UI served by the same Flue server that will host the example's Agent APIs.

## Commands

```sh
pnpm run dev          # build the UI once, then start the Flue development server
pnpm run build:ui     # rebuild the UI after frontend changes
pnpm run check:types  # run Svelte and TypeScript checks
pnpm run build        # build dist/server.mjs, then dist/client
node dist/server.mjs  # serve the production build from this directory
```

The server and UI use separate Vite invocations. Build order matters: the Flue build owns `dist/`, so it runs first and the SvelteKit static build writes into `dist/client` afterward. Development intentionally uses the same server without a second HMR server or proxy.
