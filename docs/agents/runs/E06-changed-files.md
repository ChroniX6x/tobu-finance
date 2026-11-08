# E06 – tatsächliche Änderungsdateien

Ausgang: `aa02e294ef10aa79996b17fc613323678335248f`, clean. Abschluss: derselbe HEAD mit ausschließlich E06-Diff; erzeugt aus `git status --porcelain --untracked-files=all`. Einschließlich Abschlussdokumentation und dieses Manifests; ignorierte lokale Testlogs/Builds/Fixtures sind keine Git-Änderungsdateien.

| Datei                                                                                                                                         | Status   |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| [apps/api/docs/openapi.yaml](../../../apps/api/docs/openapi.yaml)                                                                             | geändert |
| [apps/api/src/routes/account-activity.ts](../../../apps/api/src/routes/account-activity.ts)                                                   | neu      |
| [apps/api/src/routes/account-overview.ts](../../../apps/api/src/routes/account-overview.ts)                                                   | geändert |
| [apps/api/src/server.ts](../../../apps/api/src/server.ts)                                                                                     | geändert |
| [apps/api/src/services/activity-read.ts](../../../apps/api/src/services/activity-read.ts)                                                     | neu      |
| [apps/api/src/services/activity-storage.ts](../../../apps/api/src/services/activity-storage.ts)                                               | neu      |
| [apps/api/tests/fixtures/activity-stack.mjs](../../../apps/api/tests/fixtures/activity-stack.mjs)                                             | neu      |
| [apps/api/tests/integration/activity-read.test.mjs](../../../apps/api/tests/integration/activity-read.test.mjs)                               | neu      |
| [apps/web/src/app/accounts/account-overview/account-overview.html](../../../apps/web/src/app/accounts/account-overview/account-overview.html) | geändert |
| [apps/web/src/app/accounts/account-overview/account-overview.ts](../../../apps/web/src/app/accounts/account-overview/account-overview.ts)     | geändert |
| [apps/web/src/app/accounts/accounts.routes.ts](../../../apps/web/src/app/accounts/accounts.routes.ts)                                         | geändert |
| [apps/web/src/app/accounts/activity/account-activity.html](../../../apps/web/src/app/accounts/activity/account-activity.html)                 | neu      |
| [apps/web/src/app/accounts/activity/account-activity.scss](../../../apps/web/src/app/accounts/activity/account-activity.scss)                 | neu      |
| [apps/web/src/app/accounts/activity/account-activity.ts](../../../apps/web/src/app/accounts/activity/account-activity.ts)                     | neu      |
| [apps/web/src/app/accounts/activity/activity-data.service.ts](../../../apps/web/src/app/accounts/activity/activity-data.service.ts)           | neu      |
| [apps/web/src/app/accounts/activity/activity-presentation.spec.ts](../../../apps/web/src/app/accounts/activity/activity-presentation.spec.ts) | neu      |
| [apps/web/src/app/accounts/activity/activity-presentation.ts](../../../apps/web/src/app/accounts/activity/activity-presentation.ts)           | neu      |
| [apps/web/tests/e2e/activity.real.spec.ts](../../../apps/web/tests/e2e/activity.real.spec.ts)                                                 | neu      |
| [apps/web/tests/e2e/activity.spec.ts](../../../apps/web/tests/e2e/activity.spec.ts)                                                           | neu      |
| [docs/agents/runs/E06-changed-files.md](../../../docs/agents/runs/E06-changed-files.md)                                                       | neu      |
| [docs/agents/runs/E06.md](../../../docs/agents/runs/E06.md)                                                                                   | neu      |
| [docs/architecture/activity-read.md](../../../docs/architecture/activity-read.md)                                                             | neu      |
| [docs/architecture/api-endpoints.md](../../../docs/architecture/api-endpoints.md)                                                             | geändert |
| [docs/architecture/contracts.md](../../../docs/architecture/contracts.md)                                                                     | geändert |
| [docs/architecture/event-platform-adr.md](../../../docs/architecture/event-platform-adr.md)                                                   | geändert |
| [docs/development.md](../../../docs/development.md)                                                                                           | geändert |
| [docs/migration/open-issues.md](../../../docs/migration/open-issues.md)                                                                       | geändert |
| [packages/contracts/src/activity.ts](../../../packages/contracts/src/activity.ts)                                                             | geändert |
| [packages/contracts/src/endpoints.ts](../../../packages/contracts/src/endpoints.ts)                                                           | geändert |
| [packages/contracts/tests/activity-read.test.mjs](../../../packages/contracts/tests/activity-read.test.mjs)                                   | neu      |
| [scripts/check-contracts.mjs](../../../scripts/check-contracts.mjs)                                                                           | geändert |

31 Dateien. Pflichtnachweis gemäß §61.6; A/Q und Quellenfingerprint siehe [E06.md](E06.md).
