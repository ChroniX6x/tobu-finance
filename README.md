# ToBu Finance

Angular-Frontend und Express/MongoDB-API in einem gemeinsamen npm-Workspace.

| Pfad | Inhalt |
| --- | --- |
| `apps/web` | Angular und Browsertests |
| `apps/api` | Express, Datenbanklogik und API-Tests |
| `packages/contracts` | Gemeinsame Zod-Verträge und OpenAPI-Grundlage |
| `infra` | Lokale Docker-Datenbank |
| `docs/database/legacy-migrations` | Historischer Schemaweg, außerhalb aktiver Runner |

## Einrichten und starten

Voraussetzungen: Node **24.13.1**, npm **11.8.0**, Docker mit laufender Linux-Engine. Im Repository-Root einmalig:

```powershell
npm ci
npm run setup
```

Täglich reicht:

```powershell
npm run dev
```

Web: <http://localhost:4200>, OpenAPI: <http://127.0.0.1:4000/docs>. API, Web und gemeinsame Verträge werden überwacht. `Ctrl+C` beendet die Entwicklungsprozesse. `npm run dev:down` stoppt die Docker-Datenbank und erhält das Volume einschließlich manuell erstellter Testdaten. Eine native MongoDB wird nicht benötigt. Das Projekt verwendet MongoDB **9.0.4**.

Setup erzeugt fehlende lokale Konfiguration und Schlüssel sowie einmalig Baseline und Demo. Wiederholtes Setup überschreibt keine vorhandenen Daten. Demo-Login: `alice@demo.tobu.test`, Passwort `Tobu-Demo-2026!`. Diese Zugangsdaten sind ausschließlich für die lokale Entwicklung vorgesehen.

Details zu VS Code, Datenbankszenarien, externem DB-Modus und bewusstem Reset: [Entwicklungsanleitung](docs/development.md).

## Prüfen und bauen

Chromium einmalig installieren und für Karma verfügbar machen (PowerShell):

```powershell
npm exec --workspace=@tobu/web -- playwright install chromium
$env:CHROME_BIN = (node -p "require('@playwright/test').chromium.executablePath()")
npm run quality:full
```

`quality` enthält die Prüfungen ohne Docker; `quality:full` beziehungsweise `verify:phase5` ergänzt isolierte API-/Browser-Integration, Lifecycle und eine saubere Produktionsinstallation. Ergebnisbericht: `test-results/quality.json`. Tests benötigen keine manuell gestartete API und verändern keine Entwicklungsdatenbank.

```powershell
npm run build
npm run package:artifact
```

Das Ergebnis liegt unter `dist/release`. Installation und Start des gebauten Pakets: [Artefaktanleitung](docs/production-artifact.md). Das ist noch kein eingerichtetes produktives Hosting.

Nur `package-lock.json` im Root ist aktiv; Installationen erfolgen im Root. Die gemeinsame Schnittstelle ist in [Vertragsarchitektur](docs/architecture/contracts.md) beschrieben.

## Übergang und offene Arbeiten

Der Nutzer hat das automatisierte Gate 5 als erfolgreich bestätigt. [Phase 6](docs/migration/phase-6-handover.md) beschreibt den noch ausstehenden Übergang auf GitHub, die manuelle Abnahme und den Rückfallweg. Für Push, PR, CI, Merge und die spätere Archivierung gibt es eine separate [GitHub-Einweisung](docs/migration/github-transition.md).

Die vollständige Rollenprüfung, die automatische Owner-Zuordnung bei Kontoerstellung und bestehende Sicherheitsbefunde bleiben [offene Arbeiten](docs/migration/open-issues.md). Ein grüner Migrationscheck bedeutet keine Freigabe für den Livebetrieb.
