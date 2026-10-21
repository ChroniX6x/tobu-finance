# ToBu Finance

Angular-Frontend und Express/MongoDB-API in einem privaten npm-Workspace.

- `apps/web`: Angular-Anwendung und Browsertests.
- `apps/api`: Express-API, OpenAPI und API-Tests.
- `packages`: gemeinsame Vertr?ge ab Phase 4.
- `infra`: lokale Docker-Datenbank.
- `docs/database/legacy-migrations`: historische Migrationen, au?erhalb von Build und Runner.

## Start

Node **24.13.1**, npm **11.8.0**, Docker mit laufender Linux-Engine. Im Repository-Root:

```powershell
npm ci
docker pull mongo:9.0.4
npm run setup
npm run dev
```

Web: <http://localhost:4200>, OpenAPI: <http://127.0.0.1:4000/docs>. `Ctrl+C` beendet API und Web. `npm run dev:down` stoppt die Datenbank; das persistente Volume und manuelle Testdaten bleiben erhalten. Keine native MongoDB erforderlich.

Setup erzeugt fehlende lokale Konfiguration/Schl?ssel und initialisiert Baseline und Demo einmalig. Wiederholtes Setup ?berschreibt keine bestehenden Daten. Demo-Login: `alice@demo.tobu.test`, Passwort `Tobu-Demo-2026!`. Rollenfixtures sind vorbereitet; vollst?ndige Kontozugriffskontrolle ist ein gesonderter Umsetzungspunkt.

Konfiguration, externer DB-Modus, Seed-Szenarien, Reset und VS Code: [Entwicklungsanleitung](docs/development.md).

## Qualit?t

```powershell
npm run check:workspace
npm run typecheck
npm run build
npm run test:tooling
npm test
npm run e2e
npm run test:integration
npm run e2e:real
```

F?r Karma Chrome installieren. Playwright einmalig mit `npm exec --workspace=@tobu/web -- playwright install chromium` vorbereiten. Integration und echte Browser-E2E erstellen ihre eigene Docker-Datenbank, API, Testnutzer und Schl?ssel. Kein manueller Testserver und keine Zugangsdaten n?tig.

`npm run verify:phase3` b?ndelt die automatisierte Abnahme einschlie?lich Neustart/Persistenz und Fehlerf?llen in einem eigenen, anschlie?end entfernten Docker-Stack. [Gate-3-Anleitung und Pr?fstatus](docs/migration/phase-3-verification.md).

Nur die Root-Datei `package-lock.json` ist aktiv. Keine Installationen in einzelnen Apps. Build-Ausgaben: `apps/api/dist` und `apps/web/dist/tobu-finance`. Produktionshosting muss relative `/api`-Aufrufe an die API weiterleiten; Entwicklungs-Compose und Demo-Seed sind kein Produktionsdeployment.
