# Phase 5 – Gesamtabnahme und CI

Stand: 22.10.2026. Branch: `chore/monorepo-phase-5`. Automatisiertes Gate 5 laut Nutzer erfolgreich. Manuelle Abnahme und GitHub-CI bleiben offen. Phase 6 wartet auf Freigabe.

## Best?tigte automatisierte Abnahme

Der Nutzer meldete nach den Phase-5-Korrekturen zuletzt ?Gate 5 automated verification passed?. Damit ist der vollst?ndige automatisierte Pr?flauf einschlie?lich Real-API-Browser, Docker-Lifecycle und isolierter Produktionsinstallation laut Nutzer erfolgreich. Letzter bereitgestellter Implementierungscommit: b3feab5; der Bericht test-results/quality.json wurde hier nicht eingelesen und die genaue Commit-ID auf dem Testrechner nicht unabh?ngig gepr?ft.

Die weiter unten aufgef?hrten lokalen Einschr?nkungen und vorherigen Fehlversuche dokumentieren den Verlauf; die dort noch angeforderten automatisierten Wiederholungen sind durch diese Nutzerbest?tigung erledigt. Weiter offen bleiben ein frischer Checkout mit manueller Einrichtung, Terminal-Ctrl+C, VS-Code-Debugging und die Persistenz einer ?ber die UI angelegten Buchung sowie der GitHub-Actions-Lauf. AUTH-001/AUTH-002 und SECURITY-001 bleiben eigenst?ndige offene Punkte. Keine Freigabe oder Umsetzung von Phase 6.

## Umsetzung

- `npm run quality`: Workspace-Provenienz, Quellcode-/Whitespace-Prüfung, Typechecks, Vertrags-/OpenAPI-Prüfung, Vertrags- und Unit-Tests, Produktionsbuilds und Mock-E2E.
- `npm run quality:full` bzw. `npm run verify:phase5`: zusätzlich echte Docker-Integration, Real-API-Browser, Setup-/Start-/Stop-/Persistenzprüfungen und isolierter Artefakttest. Kein stilles Überspringen fehlender Testkonfiguration oder fehlender Docker-Engine.
- Jeder Lauf schreibt Commit, Änderungsstatus, Befehle und Ergebnisse nach `test-results/quality.json`; bei Fehlern wird mit Fehlerstatus abgebrochen.
- GitHub Actions: vollständiger Linux-/Docker-Job und Windows-Job für die Docker-unabhängigen Prüfungen. Beide starten mit `npm ci`; Linux prüft außerdem, dass die Installation das Lockfile nicht verändert. Kurzlebige Testschlüssel und eigene Datenbanken; keine Repository-Secrets erforderlich. Testprotokoll und erfolgreich gebautes Release werden als Artefakte gespeichert.
- `npm run package:artifact` stellt nach dem Build `dist/release` zusammen: kompilierte API, Contracts, Angular-Dateien, OpenAPI, kompilierte Baseline-/Seed-/Migrationslogik, Workspace-Manifeste und Lockfile. Keine historischen Migrationen, lokalen Schlüssel oder `.env`-Dateien.
- `npm run test:artifact` kopiert das Paket in ein unabhängiges temporäres Verzeichnis, installiert mit `npm ci --omit=dev` und prüft Start, Web-Proxy, Auth, Health/Readiness, OpenAPI und Shutdown. `tsx`, TypeScript und API-/Web-Quellen dürfen dort nicht vorhanden sein.
- TEST-001 behoben: passende Mocks für zusätzliche Übersichts-/Kontolistenrequests; fehlende Mocks werden vor dem Vite-Proxy mit Methode und Pfad als Testfehler erfasst. Ein Negativtest prüft diese Sperre. Keine pauschalen 200-Antworten und kein Unterdrücken von Proxyfehlern.
- Real-API-Browserabdeckung erweitert: explizite Nutzer-/Owner-Fixture, Kontoübersicht, Stammdaten, Monat, Planung sowie Buchung über UI anlegen, nach Reload ändern und löschen. Der bestehende Session-/Refresh-/Logout-Test bleibt verpflichtend.
- UI-001 behoben: vorgemerkte Buchung ohne Datum benötigt einen expliziten Monat. Die API berücksichtigt diesen auch beim Leeren des Datums; Monatsänderungen des Parents werden an seine Splits weitergegeben. Integrationstest und Browserprüfung ergänzt.
- Im Real-API-Test gefunden und behoben: fehlender `MessageService`-Provider der Planungsroute verhinderte deren Laden.
- Künftiger Migrationsweg separat geprüft: aktueller Baseline-Stand ist wiederholt ein unverändernder No-op, unbekannte Versionen werden abgelehnt. Es gibt noch keine unterstützte Vorgängerversion und daher keinen erfundenen Upgrade-Pfad.

## Umfang von Format und Lint

ESLint 9.39.1 mit empfohlenen JavaScript-/TypeScript-Regeln (typescript-eslint 8.72.0) und Prettier 3.6.2 sind als exakte Entwicklungsabhaengigkeiten installiert. check-source.mjs ergaenzt Syntax-, Konfliktmarker-, Testdisziplin- und Browserimportregeln.

Altbefunde aus Commit 0166768 stehen in evidence/lint-baseline.json und evidence/format-baseline.json. Lint-Ausnahmen gelten nur fuer bestehende Regel-/Meldungs-/Codekombinationen samt Anzahl; Format-Ausnahmen nur fuer unveraenderte Inhalte. Neue/geaenderte Dateien muessen formatiert sein. CI erweitert die Baselines nicht automatisch. QUALITY-001 ist umgesetzt; SECURITY-001 bleibt offen.

## Lokale Nachweise

Artefakt-Nachtrag: Die saubere Produktionsinstallation lief auf dem Nutzerrechner durch, installierte aber über `apps/web → primeclt → tsx` einen TypeScript-Runner. `primeclt` ist ein nicht in den Anwendungsquellen verwendetes CLI und wurde bei unveränderter Version 0.1.5 in die Web-devDependencies verschoben. Das Lockfile wurde durch npm neu berechnet; sämtliche Paketversionen bleiben unverändert. Der Workspace-Check verlangt zusätzlich, dass primeclt, tsx und TypeScript im Dependency-Graph ausschließlich Entwicklungsabhängigkeiten sind. Die echte Artefaktprüfung auf Abwesenheit dieser Runner bleibt bestehen. Der erneute isolierte Installationstest ist noch auf dem Docker-Rechner auszuführen. Der frühere Audit-Bericht bleibt eine historische Momentaufnahme; insbesondere seine Produktionszuordnung für die primeclt-Kette ist damit überholt, die Sicherheitsbefunde werden dadurch nicht pauschal behoben.

Lifecycle-Nachtrag: Der absichtlich ausgeführte zweite `dev`-Start prüfte belegte Ports erst nach dem Contracts-Build. Das erneute Schreiben von `packages/contracts/dist` startete die bereits laufende API neu; ein direkt anschließender Proxy-Login konnte dadurch mit ECONNRESET/HTTP 500 scheitern. Die Portprüfungen für API, Web und Debugger stehen jetzt vor dem Build. Ein Tooling-Regressionstest prüft bei belegtem API- und Web-Port, dass der Start abgelehnt wird und sämtliche Contract-Ausgabedateien ihre Änderungszeit behalten. Der Login wird nicht automatisch wiederholt; der vollständige Lifecycle-Lauf auf dem Docker-Rechner bleibt zur Bestätigung erforderlich.

Session-Start: Beim Real-API-Test blieb ein Seitenwechsel auf der Loginseite hängen, obwohl zuvor Refresh und Stammdaten erfolgreich waren. Im Client liefen die blockierende Erstnavigation und der asynchrone Auth-Initializer parallel; der Guard konnte dadurch vor der Session-Wiederherstellung entscheiden. Die Anwendung nutzt jetzt die normale Erstnavigation nach Abschluss der App-Initialisierung. Ein eigener Mock-Browsertest hält die Refresh-Antwort bis nach dem Laden des Dokuments zurück und verlangt anschließend die geschützte Kontoseite ohne Login-Umleitung. Der vollständige Real-API-/Docker-Nachweis auf dem betroffenen Rechner bleibt erforderlich.

Weiterer Nutzerbefund: Drei Mock-E2E-Assertions auf Titel, Betrag und Kategorie liefen nach fünf Sekunden ab; der anschließend erfasste Fehlerkontext enthielt die erwartete Buchungszeile vollständig. Das spricht für verspätetes initiales Rendern. Die Transaktionsseiten-Suite wartet jetzt vor den Einzelprüfungen ausdrücklich auf die GET-Antwort für das richtige Konto, deren vollständigen Empfang und die sichtbare Fixture-Zeile (maximal 15 Sekunden). Die Einzelassertions behalten ihr bisheriges Zeitlimit; keine Sleeps, automatischen Retries oder global erhöhten Timeouts. Die Bestätigung auf dem betroffenen Rechner steht noch aus.

Nachtrag zur Gate-5-Abnahme: Der erste Phase-5-Commit enthielt einen formatabhängigen Fehler im Vertragscheck. Dessen Regex erkannte nur doppelt zitierte Routenpfade; nach der Prettier-Formatierung fehlten deshalb die vier Transaktionsrouten in der erkannten Liste. Die Routen und Verträge selbst waren vorhanden. Der Check verwendet nun den vorhandenen TypeScript-Parser und erkennt alle 50 Routen unabhängig von Anführungszeichen und Zeilenumbrüchen. Zwei Regressionstests prüfen außerdem Kommentare, fremde Router, Duplikate und die ausdrückliche Ablehnung dynamischer Pfade. `check:contracts` wurde nach dieser Korrektur erneut erfolgreich ausgeführt. Gate 5 muss auf dem Docker-Rechner mit dem korrigierten Stand erneut gestartet werden.

| Prüfung | Ergebnis / Grenze |
| --- | --- |
| ESLint, Prettier | erfolgreich; dokumentierte Altbestandsausnahmen |
| Workspace, Typechecks, OpenAPI-/Vertragsgrenzen | erfolgreich |
| API- und Web-Produktionsbuild | erfolgreich; bisherige Angular-Warnungen zu Stylesheet, Budget und lodash bleiben |
| Vertrags-, API-Unit-, Tooling-Tests | 7 / 5 / 3 erfolgreich |
| Web-Unit | 4 erfolgreich mit separat gestartetem Chrome; regulärer Karma-Launcher in dieser Umgebung weiterhin eingeschränkt |
| Mock-E2E | 52 erfolgreich; Chrome, Video aus, separat gestarteter Angular-Testserver; keine unerwarteten API-Requests |
| Real-API-E2E | 3 inklusive Auth-Setup erfolgreich; isolierte native MongoDB 8.2 und separat verwalteter Angular-Testserver |
| API-/Baseline-/Seed-Integration | 17 inklusive Obertests erfolgreich mit isolierten Datenbanken auf nativer MongoDB 8.2 |
| Produktionslaufzeit mit Proxy | lokale Diagnose erfolgreich mit vorhandenen Dependencies: `NODE_ENV=production`, kompilierte API/Web, Auth, Readiness, OpenAPI, Prozessende |
| Saubere Produktionsinstallation | offen: Offline-Installationen scheitern an fehlenden Cache-Paketen; bestehende Dependencies ersetzen diesen Nachweis nicht |
| Vollständiger Docker-Lauf und frischer Checkout | offen: Docker-Konfiguration/Pipe hier nicht zugreifbar; keine automatische native Ersatzdatenbank im Gate |
| GitHub Actions | Workflow eingerichtet, noch nicht auf GitHub ausgeführt; ohne Push ist dort keine Abnahme möglich |

Die nativen Diagnosen sind **kein Nachweis mit MongoDB 9.0.4**. Temporäre Diagnosekonfigurationen werden nicht committed. Tests verwenden eigene Datenbanken; keine Entwicklungsdatenbank wurde zurückgesetzt.

## Noch auszuführen / am Ende gesammelt

Den Phase-5-Stand zuerst auf den Docker-Rechner übertragen. Im Repository-Root:

```powershell
npm ci
npm exec --workspace=@tobu/web -- playwright install chromium
$env:CHROME_BIN = (node -p "require('@playwright/test').chromium.executablePath()")
npm run verify:phase5
```

Erwartet: `GATE 5 AUTOMATED VERIFICATION PASSED`. Den Bericht `test-results/quality.json` zusammen mit dem Commit aufbewahren. Der vollständige Lauf benötigt Paketdownloads für die saubere Produktionsinstallation und Docker mit Linux-Containern.

Für die Frisch-Checkout-Abnahme denselben Branch in ein neues Verzeichnis klonen (nach separat beauftragtem Push oder lokal aus dem vorhandenen Git-Repository). Dort ohne kopierte `node_modules` oder `.env` die [Entwicklungsanleitung](../development.md) mit `npm ci`, `npm run setup`, `npm run dev` nachvollziehen. Die Lifecycle-Suite prüft Setup-Wiederholung, Portkonflikte, externe DB-Fehler, Start/Stop und Persistenz ebenfalls mit eigenem Compose-Projekt.

Noch separat zu bestätigen: Terminal-Ctrl+C beendet die Prozesse; VS-Code-Debugging funktioniert; eine über die UI angelegte Buchung bleibt nach `npm run dev:down` und erneutem Start erhalten. Die bereits bestätigte Phase-4-Hot-Reload-Prüfung bleibt gültig.

Für eine vollständige Gesamtabnahme bleiben AUTH-001/AUTH-002 und SECURITY-001 ausdrücklich sichtbar. Owner-Zuordnung und Rechte werden gemäß früherer Entscheidung separat nach der Zusammenlegung umgesetzt; ein grünes Gate belegt diese noch nicht implementierten Funktionen nicht. GitHub-Branchregeln mit den beiden Quality-Jobs als Pflichtchecks werden erst beim GitHub-Übergang eingerichtet. Phase 6 startet nicht automatisch.

Workflow-Referenzen: [GitHub Node.js CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs), [Setup Node](https://github.com/actions/setup-node), [Upload Artifact](https://github.com/actions/upload-artifact).
