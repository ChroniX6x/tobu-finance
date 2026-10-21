# ToBu Finance

Angular-Frontend und Express/MongoDB-API in einem privaten npm-Workspace.

- `apps/web` — `@tobu/web`, Angular-Anwendung und Browsertests.
- `apps/api` — `@tobu/api`, Express-API, OpenAPI, historische Migrationen und API-Tests.
- `packages` — reserviert für gemeinsame Verträge ab Phase 4.
- `docs/migration` — Transformationsplan, Herkunftsnachweise und Prüfprotokolle.

## Installation

Node **24.13.1**, npm **11.8.0**. Im Repository-Root:

```powershell
npm ci
npm run check:workspace
```

Nur die Root-Datei `package-lock.json` ist aktiv. Historische Lockdateien unter `docs/migration/legacy-lockfiles` dienen dem Versionsvergleich. Installationen in einzelnen Apps und Yarn sind nicht mehr Teil des Arbeitsablaufs.

## Entwicklung (Stand Phase 2)

```powershell
npm run init:api
```

Das erzeugt fehlende API-Konfiguration und Schlüssel in `apps/api/.env`. Dort die URI einer bewusst ausgewählten Entwicklungsdatenbank konfigurieren. Die Datenbank zunächst separat starten. In zwei Terminals im Repository-Root:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

Web: `http://localhost:4200`, API: `http://localhost:4000`, OpenAPI: `http://localhost:4000/docs`. Das Frontend verwendet weiterhin diese API-Adresse. VS Code im Repository-Root öffnen; die Root-Tasks verwenden dieselben npm-Befehle.

Der gemeinsame `npm run dev`-Start mit Docker, Readiness und persistentem MongoDB-Volume wird in Phase 3 eingeführt. Phase 2 startet oder löscht keine Datenbank automatisch und führt keine Seeds/Migrationen aus.

## Qualität und Artefakte

```powershell
npm run typecheck
npm run build
npm run test:api
npm run test:web
npm run e2e
```

Für Karma muss Chrome installiert sein (gegebenenfalls `CHROME_BIN` setzen). Playwright-Browser einmalig über `npm exec --workspace=@tobu/web -- playwright install chromium` installieren. Die Mock-E2E starten den Webserver selbst; zuvor andere Server auf Port 4200 beenden.

API-Integration mit eigener temporärer nativer Instanz unter Windows:

```powershell
$env:MONGOD_BIN = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
npm run test:integration
```

Alternativ `TEST_MONGODB_URI` für einen lokalen, ausdrücklich vorgesehenen Testserver setzen und `MONGOD_BIN` entfernen. Details: [API-Testanleitung](apps/api/docs/phase-1-testing.md). Der native Weg bleibt in dieser Phase eine Testoption; der Docker-Testablauf folgt in Phase 3.

`npm run e2e:real` benötigt eine separat gestartete API mit isolierter Testdatenbank sowie `E2E_EMAIL`, `E2E_PASSWORD` und optional `API_BASE_URL` (Setup-Login). Es führt Login-Setup und den echten Session-Test aus. Die Auth-State-Datei liegt ignoriert unter `apps/web/.playwright-real-auth.json`.

Build-Ausgaben: `apps/web/dist/tobu-finance` und `apps/api/dist`. `npm run start:api` startet das gebaute API-JavaScript. `npm run build:web` und `npm run build:api` bauen die Anwendungen einzeln. Weitere API-Skripte sind über `npm run <script> --workspace=@tobu/api` erreichbar und laufen mit dem richtigen Arbeitsverzeichnis. Die alten Reset-/Seed-Skripte bleiben bis Phase 3 unverändert; sie sind kein Bestandteil des Starts oder der Installation.
