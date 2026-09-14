# flue-svelte release record

`flue-svelte@0.1.2` is published on npm with SDK `2.0.5` compatibility.
Registry tarball SHA-1: `3ce8d33c0fd8cef0d302be9e4311462fad4cf07b`.
This is an unofficial community package. The implementation and conversation
semantics are unchanged. Earlier candidate records and publication blockers
below are historical.

## Build and inspect

From the repository root, with workspace dependencies installed. The `test`
command below additionally requires the existing local `packages/svelte/test/`
checks and `packages/svelte/vitest.config.ts`, which remain uncommitted by project
convention. A clean checkout cannot reproduce that local suite; skip that command
there and use the committed archive and independent-consumer checks below. The
recorded local suite results are supplemental regression evidence.

```sh
pnpm --filter flue-svelte build
pnpm --filter flue-svelte check:types
pnpm --filter flue-svelte test
pnpm --filter svelte-chat-example check:types
pnpm --filter svelte-chat-example build
mkdir -p /tmp/flue-svelte-release
(cd packages/svelte && npm pack --dry-run && npm pack --pack-destination /tmp/flue-svelte-release)
bun packages/svelte/scripts/check-package.ts /tmp/flue-svelte-release/flue-svelte-0.1.2.tgz
```

The archive check enforces the six-file allowlist, identity, version, ESM/Svelte
exports, resolvable declaration/runtime targets, public dependencies, external
SDK/Svelte imports, uncompiled runes, complete upstream license, and attribution.
Tests, scripts, source paths, and temporary consumer projects are not shipped.
A deliberately wrong-identity archive was rejected by this check.

`@flue/sdk` is pinned to registry `2.0.5` in both peer and development dependencies;
local adapter builds no longer silently validate against the workspace SDK.
The example retains its `workspace:*` link to `flue-svelte`. No workspace-glob
change is needed: the package still lives in `packages/svelte`.

## Reproduce independent consumption

Create a fresh directory **outside** the checkout; copy only example source/config,
never `node_modules`, `.svelte-kit`, or workspace configuration. From the repo root:

```sh
consumer="$(mktemp -d /tmp/flue-svelte-consumer.XXXXXX)"
cp -R examples/svelte-chat/src "$consumer/src"
cp examples/svelte-chat/{svelte.config.js,vite.config.ts,tsconfig.json} "$consumer/"
cd "$consumer"
npm init -y
npm pkg set type=module
npm install --registry=https://registry.npmjs.org \
  /tmp/flue-svelte-release/flue-svelte-0.1.2.tgz @flue/sdk@2.0.5 \
  svelte@5.56.8 @sveltejs/kit@2.70.2 @sveltejs/vite-plugin-svelte@7.3.0 \
  vite@8.2.1 svelte-check@4.7.5 typescript@6.0.3
npx svelte-kit sync
npx svelte-check --tsconfig ./tsconfig.json
npx vite build
npm ls flue-svelte @flue/sdk svelte
```

There are no source aliases or inherited TypeScript configuration in this consumer.
The copied example's proxy only serves its optional demo backend; it is not needed
for typechecking or production compilation. To run the chat against a real backend,
start the Demo server as described in `examples/svelte-chat/README.md` in the checkout,
then `npx vite dev` in the consumer. This does not replace the isolated SDK install.

### SSR and browser acceptance

For an automated check instead of the demo backend, copy
`packages/svelte/scripts/consumer.svelte` from the checkout to the consumer's
`src/routes/+page.svelte`, remove the copied `src/routes/+page.ts`, and copy
`packages/svelte/scripts/consumer-browser.ts` to its root. In the consumer:

```sh
npm install --registry=https://registry.npmjs.org playwright@1.63.0
npx playwright install chromium
npx svelte-kit sync
npx svelte-check --tsconfig ./tsconfig.json
npx vite build
bun consumer-browser.ts
```

The browser driver starts and stops a production preview on port 4297. It asserts
SSR `idle`/dormant output (the options getter throws if evaluated on the server),
then intercepts HTTP with a controlled 404. The **real registry SDK** observes the
absent conversation; the public adapter's reactive `historyReady` becomes true
after hydration. Page errors fail the check. No SDK or reducer is mocked, and no
server credentials are needed. Existing adapter checks cover sending/lifecycle
semantics; this check covers installed-package SSR and browser activation.

Repeat in a second fresh consumer for the minimum supported Svelte, replacing the
framework toolchain in the install command with the following versions. Copy the
acceptance fixture and remove `+page.ts` **before** typechecking/building this
consumer: the full chat example does not build on this older compiler (see the
ticket 02 record below).

```sh
npm install --registry=https://registry.npmjs.org \
  svelte@5.3.0 @sveltejs/kit@2.16.0 @sveltejs/vite-plugin-svelte@5.0.3 vite@6.0.11
```

Keep the SDK, tarball, TypeScript, svelte-check, and browser driver versions the same.
Both toolchains use the ordinary `sveltekit()` Vite plugin; no special export
conditions, dependency aliases, or peer-dependency bypasses are needed.
The older toolchain is a compatibility check, not a recommended new-app baseline:
npm reported five advisories in its development dependencies (including two high).

## Flue 2.0.5 update

The adapter now uses registry SDK `2.0.5`; the example also uses registry runtime
and Vite plugin `2.0.5`. No adapter source changes were needed. Adapter typecheck,
all 36 tests, adapter build, and example typecheck/build passed. The adapter
retains its existing source-only svelte-check warning. Earlier independent
browser/minimum-Svelte checks below used `2.0.3`, not `2.0.5`.

## Validation record (Flue 2.0.3)

- Registry SDK `2.0.3` exports the required `observe()` API and observation types.
- Independent npm-installed consumers: minimum Svelte `5.3.0` / Kit `2.16.0` /
  plugin `5.0.3` / Vite `6.0.11`, and current Svelte `5.56.8` / Kit `2.70.2` /
  plugin `7.3.0` / Vite `8.2.1`: both acceptance-fixture consumers passed
  svelte-check (zero errors/warnings), production build, SSR dormancy, and
  Playwright browser observation (not the full chat example on 5.3.0). Both used
  SDK `2.0.3`, TypeScript `6.0.3`, svelte-check `4.7.5`, Playwright `1.63.0`,
  and Chromium `153.0.8010.12`. Artifacts/logs are in
  `/tmp/flue-svelte-release/{fresh,minimum}` for this session; the committed
  commands and fixtures above recreate them without depending on that directory.
- An earlier exploratory consumer mixed incompatible framework peer versions and
  failed browser hydration. It is not compatibility evidence; fresh npm installs
  with the supported peer matrices above pass without adapter changes.
- Svelte MCP `@sveltejs/mcp@0.1.26` autofixer ran on the changed example and the
  new consumer component using `bunx --package @sveltejs/mcp@0.1.26 svelte-mcp
svelte-autofixer <file> --svelte-version 5`. Consumer: no issues or suggestions.
  The example retains one pre-existing `href`/`resolve()` warning for an SDK file
  URL: that URL is an attachment destination, not a SvelteKit route, so rewriting
  it with the route resolver would be inappropriate.
- Adapter build: passed, tsdown `0.22.14`; SDK `2.0.3`, Svelte `5.56.8`.
- Adapter typecheck: zero errors; existing warning that the source-only config
  contains no `.svelte` components (the entry is `.svelte.ts`).
- Adapter lifecycle file: 23 tests passed. Final adapter suite: all 36 tests in
  three files passed, including SSR and the existing package-local parity checks.
  Those checks and their existing Vitest config remain uncommitted.
- Local `svelte-chat-example`: typecheck and production build passed, Kit `2.70.2`,
  Vite `8.2.1`, plugin `7.3.0`, Svelte `5.56.8`.
- Workspace `pnpm check:types`: 113 tasks successful (107 cached).
- Full workspace `npm test` (`turbo test`): attempted, blocked by pnpm's
  `ERR_PNPM_IGNORED_BUILDS` for Sharp `0.35.2` / `0.35.3` during automatic dependency
  checking. Retrying with `pnpm_config_verify_deps_before_run=false npm test`
  bypassed the install check, but failed because unrelated packages have no test
  files (Vitest exits 1): first `@flue/messenger`, then `@flue/notion`,
  `@flue/runtime`, and `@flue/mongodb` on the final run. No unrelated test scripts
  or build approvals were changed.
- Initial local SSR execution failed with a missing installed Svelte runtime
  module; `pnpm install --frozen-lockfile --ignore-scripts` repaired the install,
  and all adapter checks subsequently passed.
- Lockfile regeneration used `pnpm install --lockfile-only --ignore-scripts
--registry=https://registry.npmjs.org --config.minimumReleaseAge=0` because the
  configured registry metadata lacked publication times. This was a one-command
  override; the repository's release-age policy was not changed. The lockfile diff
  only changes the adapter identity link and adds registry SDK `2.0.3`.

## Continuation verification

Rebuilt and repacked the candidate from `4bfc3d5f`; the six-file archive check
passed. Tarball SHA-1: `033d308dd8e30798773211316e84b2ae72c877b7`.
The archive is `/tmp/flue-svelte-continuation/flue-svelte-0.1.0.tgz`.

Repeated the commands above in two newly created, npm-installed consumers outside
this checkout: `/tmp/flue-svelte-current.GLF7nu` and
`/tmp/flue-svelte-minimum.1lvGhh`. Both documented version matrices passed the
acceptance fixture's `svelte-check`, production build, SSR dormancy, and browser
observation (not the full chat example on 5.3.0) using the
public SDK `2.0.3`; `npm ls` confirmed single deduplicated SDK/Svelte versions.
The current toolchain reported two low-severity npm advisories; the minimum
compatibility toolchain reported five (one low, two moderate, two high).

- `pnpm --filter flue-svelte build`: passed, tsdown `0.22.14`.
- `pnpm --filter flue-svelte check:types`: zero errors, the same source-only warning.
- `pnpm --filter flue-svelte exec vitest run test/use-flue-agent.lifecycle.test.ts`:
  23 passed; `pnpm --filter flue-svelte test`: all 36 passed, Vitest `4.1.10`.
- `pnpm --filter svelte-chat-example check:types` and `build`: passed.
- `pnpm check:types`: all 113 tasks passed (109 cached).
- Full workspace `npm test`: failed because `@flue/vite` has no test files;
  Turbo then cancelled other tasks. The adapter's separate suite passed above.
  No unrelated test scripts or pre-existing workspace build-approval edits were
  changed. Logs: `/tmp/flue-svelte-continuation/workspace-{types,tests}.log`.
- The Bun autofixer launcher hit a broken cached `sade` install. Retried both
  changed Svelte components with the same MCP version via npm; both returned no
  issues or suggestions:

  ```sh
  npm exec --yes --registry=https://registry.npmjs.org --package=@sveltejs/mcp@0.1.26 -- svelte-mcp svelte-autofixer packages/svelte/scripts/consumer.svelte --svelte-version 5
  npm exec --yes --registry=https://registry.npmjs.org --package=@sveltejs/mcp@0.1.26 -- svelte-mcp svelte-autofixer examples/svelte-chat/src/routes/+page.svelte --svelte-version 5
  ```

## Ticket 02 acceptance record

Ticket: [02 — verify release candidate](../../.scratch/flue-svelte-npm/issues/02-verify-release-candidate.md).

Reused ticket 01's actual archive
`/tmp/flue-svelte-continuation/flue-svelte-0.1.0.tgz`, SHA-1
`033d308dd8e30798773211316e84b2ae72c877b7`, and its two external consumers.
No package payload, dependency declaration, adapter, or Svelte module changed in
this ticket; no new internal tests or framework were needed. The package-level
archive check and browser driver above remain the runnable release checks.

Commands executed from the checkout (consumer setup is documented above).
Archive-check stdout and registry HTTP status were also captured on the review
rerun in `/tmp/flue-svelte-ticket02/{archive-check,name-status}.log` (passed; 404):

```sh
repo="$PWD"
archive=/tmp/flue-svelte-continuation/flue-svelte-0.1.0.tgz
shasum "$archive"
bun packages/svelte/scripts/check-package.ts "$archive"
(cd packages/svelte && npm pack --dry-run)
curl -sS -o /tmp/flue-svelte-ticket02/name.json -w '%{http_code}\n' \
  https://registry.npmjs.org/flue-svelte

# Run once per directory; then repeat with /tmp/flue-svelte-minimum.1lvGhh.
consumer=/tmp/flue-svelte-current.GLF7nu
cd "$consumer"
npm install --offline --ignore-scripts "$archive"
for file in dist/index.svelte.js dist/index.svelte.d.ts package.json; do
  tar -xOf "$archive" "package/$file" | cmp - "node_modules/flue-svelte/$file"
done
npm ls flue-svelte @flue/sdk svelte @sveltejs/kit @sveltejs/vite-plugin-svelte \
  vite typescript svelte-check playwright
cp "$repo/examples/svelte-chat/src/routes/"+page.{svelte,ts} src/routes/
npx --no-install svelte-kit sync
npx --no-install svelte-check --tsconfig ./tsconfig.json
npx --no-install vite build
# Record the full-example result separately, then test the acceptance fixture:
cp "$repo/packages/svelte/scripts/consumer.svelte" src/routes/+page.svelte
rm src/routes/+page.ts
cp "$repo/packages/svelte/scripts/consumer-browser.ts" .
npx --no-install svelte-kit sync
npx --no-install svelte-check --tsconfig ./tsconfig.json
npx --no-install vite build
bun consumer-browser.ts
```

**Passed:** archive identity/file checks and pack preview (same checksum);
installed manifest, runtime, and declarations byte-matched against the archive;
independent public API/type consumption via the full example on both matrices
(zero svelte-check errors/warnings); full-example production build on the current
matrix. Both acceptance-fixture matrices passed typecheck, production build,
SSR `idle`/dormant rendering with a server-throwing options getter, then browser
hydration with one intercepted HTTP request through the real SDK and a visible
`historyReady` update. No internal reducer was mocked. Existing SSR/lifecycle
checks provide supplemental observation/lifecycle regression coverage.
`npm ls` confirmed SDK `2.0.3`, Svelte `5.3.0` and `5.56.8`, respectively, with
the exact toolchain versions listed above and no workspace links. This verifies
two concrete matrices, not every possible Svelte/toolchain combination.

**Failed, outside the minimal adapter acceptance boundary:** the full chat example
on Svelte `5.3.0` typechecks but its production build fails in `vite-plugin-svelte`
with `Not implemented type annotation EmptyStatement`. Do not interpret earlier
records as proof that the full example builds on the minimum compiler. The
installed adapter compiles and runs with the minimal fixture on that same
compiler, so its `^5.3.0` peer range is retained; use the current matrix for the
full demo. No example or compiler workaround was introduced.

External logs: `/tmp/flue-svelte-ticket02/flue-svelte-{current.GLF7nu,minimum.1lvGhh}.log`.
Both fixture sequences were also rerun with failure-short-circuiting commands;
those successful logs have the suffix `-acceptance.log`. Temporary logs are local
session evidence, not required inputs to reproduce the committed checks.

### Ticket 02 local regression checks

All commands below used `pnpm_config_verify_deps_before_run=false` to avoid
mutating the pre-existing workspace build-approval edits during automatic
installation checks. No dependencies were installed and those edits were left
untouched. Local versions: Node `24.20.0`, pnpm `11.1.1`, Bun `1.4.0`, SDK
`2.0.3`, Svelte `5.56.8`, tsdown `0.22.14`, Vitest `4.1.10`.

```sh
export pnpm_config_verify_deps_before_run=false
pnpm --filter flue-svelte build
pnpm --filter flue-svelte check:types
pnpm --filter flue-svelte exec vitest run test/use-flue-agent.lifecycle.test.ts
pnpm --filter flue-svelte exec vitest run test/use-flue-agent.ssr.test.ts
pnpm --filter flue-svelte test
pnpm --filter svelte-chat-example check:types
pnpm --filter svelte-chat-example build
pnpm check:types
npm test
# Turbo cancelled an in-flight adapter build after the unrelated test failure.
# Restore dist with a successful standalone build:
pnpm --filter flue-svelte build
```

**Passed:** standalone builds; adapter typecheck (zero errors, the existing
source-only warning); lifecycle 23/23; SSR 1/1; package suite 36/36; local example
typecheck/build; workspace typecheck 113/113 (109 cached). After restoring `dist`,
all six package payload files byte-matched the previously validated archive
(`tar -xOf "$archive" "package/$file" | cmp - "packages/svelte/$file"` for each
allowlisted file). No replacement candidate is needed. Existing parity checks
remain uncommitted. No Svelte source/module changes required another autofixer run.

**Failed:** full workspace `npm test`, executed once after the other local checks,
exited 1: `@flue/sdk` (also telegram/resend/runtime) has no test files. Turbo
cancelled remaining work; this is not a passing full suite. No unrelated test
scripts were changed. Local commands/results and logs are in
`/tmp/flue-svelte-ticket02/local-checks.md` and `01-build.log` through
`09-workspace-npm-test.log`; the restored build is `restore-build.log`.

**Unverified:** final first version, account publishing rights, and npm
registration eligibility. Registry lookup succeeded with HTTP 404; there was no
network blocker for that lookup. Publication remains blocked on the maintainer
checklist below, not on a claim that a successful local build confers permission
to publish.

## Before publication — blocked on maintainer input

- Confirm the final first version. `0.1.0` is the candidate default, not a
  maintainer-approved release number. Update the archive check if it changes.
- Maintenance metadata is https://github.com/xvin-zr/flue (homepage, repository,
  issues). Recheck it still matches `origin` before publish.
- Recheck the final package name and account permissions on
  `https://registry.npmjs.org`. A public lookup returned HTTP 404 during ticket 02;
  **404 does not guarantee registration is allowed**, reserve the name, or prove
  account permissions. Name eligibility and publishing rights remain unverified.
- Rebuild, repack, and repeat the archive check and both independent-consumer
  matrices after any package/metadata/dependency change. Review the exact archive
  checksum; do not publish an archive whose validation predates those changes.
- Obtain separate, explicit authorization for public publication. No publish,
  login, credential setup, or automatic release pipeline was executed here.

Only after those blockers are resolved, the authorized maintainer can run:

```sh
# Read-only account/name checks; these do not prove npm will accept publication.
npm whoami --registry=https://registry.npmjs.org
npm view flue-svelte name version maintainers --registry=https://registry.npmjs.org
# If the name exists, confirm ownership/access; otherwise confirm first-publish
# eligibility with npm. Do not treat E404 as authorization.

# Set this to the FINAL rebuilt and independently validated archive.
archive=/absolute/path/to/flue-svelte-APPROVED_VERSION.tgz
shasum "$archive"
npm publish "$archive" --dry-run --access public --registry=https://registry.npmjs.org
# Only with explicit authorization and the account's required 2FA/OTP:
npm publish "$archive" --access public --registry=https://registry.npmjs.org
```

The dry run previews package contents; it does not establish name availability or
permission to publish. After an authorized publication, verify the registry's
version and `dist` integrity against the approved artifact with `npm view`.
