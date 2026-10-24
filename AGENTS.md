# ToBu Finance: instructions for coding agents

## Start here

- Work from the repository root. This is one npm workspace: Angular in `apps/web`, Express/Mongoose in `apps/api`, shared Zod contracts in `packages/contracts`.
- Read `docs/development.md`, `docs/architecture/contracts.md` and `docs/migration/open-issues.md` before changing the relevant area. `docs/migration/phase-6-handover.md` records acceptance, not blanket approval for new work.
- Inspect branch, working tree and relevant diffs first. Preserve user changes. Work within the requested scope; do not push, merge, archive repositories or reset databases without authorization.
- Use Node 24.13.1 and npm 11.8.0. Install from the root with `npm ci`; the root `package-lock.json` is the only active lockfile. Do not casually upgrade pinned dependencies or use `npm audit fix --force`.

## Invariants to preserve

- `npm run setup` is repeatable and preserves existing data/configuration/keys. `npm run dev` starts the database, contracts watcher, API and web. Reject occupied ports before rebuilding contracts: otherwise a duplicate start can restart the live API.
- Docker development data lives in a persistent named volume. Stop/restart must preserve manual data. Never run destructive test fixtures against the development database. Never add an automatic native MongoDB fallback.
- Baseline, demo seed, integration fixtures and migrations are different concerns. A seed is not an upgrade mechanism. Never rerun historical migrations from `docs/database/legacy-migrations`, silently adopt unknown databases, relabel unknown schema versions or edit an applied migration.
- `db:migrate` executes explicitly confirmed migrations. Read `docs/database/migration-authoring.md` for plan/confirm, stopped-writer requirements and recovery. Transactional migrations are the default; structural migrations use a verified Database Tools backup and a persistent step journal. Never edit applied files (including after down), bypass the manifest or pass raw database/session handles to migration code. Keep the generated catalog and immutable migration sources together.
- Before structural work read `docs/database/structural-migrations.md`. Every step needs read-only before/after/ambiguous inspection and verification; never blindly retry partial changes. A structural lock is not a transaction fence: recovery requires the old runner AND its Database Tools processes to be stopped, all writers drained and any tagged server operations finished. Do not delete locks/journals or substitute down for recovery. Never restore a historical successful migration over later user data.
- Keep backup archives outside Git, release artifacts and MongoDB volumes. BSON data, collection options, indexes and history must survive an actual restore drill. TTL is also a writer: do not bypass the populated-TTL guard or silently disable TTL on shared/external servers. Unsupported topology/metadata requires another reviewed backup backend, not a lossy fallback. Docker helper stays local; external multi-host/SRV/TLS URIs use native tools unchanged apart from diagnostic appName.
- Before implementing a migration or its runner, read `docs/database/migration-authoring.md` and `docs/database/migration-architecture.md`. The user approved the architecture on 2026-10-23. Track implemented versus pending sections in `docs/database/migration-progress.md`; do not treat planned commands or guarantees as implemented behavior.
- Keep `src/database/baseline/2026-10-v1.json` immutable. Model changes require new migrations, not regeneration of this historical snapshot. Local Docker uses a single-node replica set; never apply its bootstrap or direct-connection URI options to external deployments. Keep `test:replica` in the full quality gate and preserve verified conversion backups outside the database volume.
- Money is integer minor units (`amountMinor`); preserve cent rounding and totals. API months use `YYYY-MM`; persisted month anchors and timezone handling must remain consistent. A pending transaction without a date needs an explicit month. Preserve parent/split constraints and cascading fields.
- Shared request/response contracts belong in `packages/contracts`. Do not add parallel frontend DTOs or database/server dependencies to that package. Update generated OpenAPI and consumer tests together. Route coverage checks must remain independent of formatting.
- Frontend API calls use the same-origin `/api` path. Preserve the development proxy and compiled-artifact proxy. No machine-specific API URLs.
- Session restoration must finish before initial protected navigation. Do not reintroduce `withEnabledBlockingInitialNavigation` alongside an independent asynchronous auth initializer. Keep the delayed-refresh regression test.
- Keep access tokens in memory and refresh cookies httpOnly. Preserve production Secure-cookie settings. A global admin does not gain access to private accounts by that role alone. Account ownership and membership confer account access. Follow `docs/migration/roles-and-access.md`; AUTH-001/AUTH-002 remain open, not already enforced everywhere.
- Keep ESM `.js` import specifiers in backend TypeScript. Resolve runtime assets relative to the module, not the caller's working directory. Compiled artifacts must start without TypeScript/tsx or source folders. Development CLIs such as primeclt remain development-only.
- Preserve zoneless Angular, OnPush, signal APIs and the established NGXS patterns. Register required route providers, including MessageService. Do not globally refactor state registration as an unrelated cleanup.

## Verification and evidence

- Run checks appropriate to changed behavior. Root commands include `check:workspace`, `check:contracts`, `lint`, `format:check`, `typecheck`, `test:tooling`, `test:contracts`, `test:api`, `test:web`, `test:integration`, `e2e`, `e2e:real`, `test:lifecycle`, `test:artifact`.
- `npm run quality:full` / `npm run verify:phase5` is the full acceptance gate. It must not skip real API, Docker or artifact tests when prerequisites are missing. Keep `test-results/quality.json` tied to the checked commit and dirty status.
- Mock browser tests reject unexpected API requests. Do not mask ECONNREFUSED with catch-all success responses. Real API tests must keep real authentication and isolated fixtures.
- Synchronize browser tests on concrete responses and rendered state. No blanket retries or global timeout increases to conceal failures. Controlled latency for a regression test is allowed and must be explained.
- Lint/format baselines record existing debt. Do not regenerate or expand them to accept new violations. Do not modify import-provenance manifests to hide unrelated changes.
- Linux CI uses system Chrome for Karma to retain its sandbox; Playwright uses its installed browser. Preserve both Linux/Docker and Windows jobs.
- Report what was actually run, what passed, what remains unverified and whether evidence came from the user or CI. A green functional gate does not resolve dependency security findings or authorize live deployment.
- Before handover, document new commands, invariants, failure recovery and remaining limitations. Keep commits reviewable and stop at agreed phase boundaries.
