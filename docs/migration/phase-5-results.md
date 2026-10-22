# Phase 5 – Gesamtabnahme und CI

Stand: 22.10.2026. Branch: `chore/monorepo-phase-5`, Ausgangscommit `0166768`. Umsetzung lokal vorbereitet; **Gate 5 noch nicht vollständig abgenommen**. Kein Push, Merge, Deployment oder Archivieren des API-Repositories. Phase 6 wartet auf eine weitere Freigabe.

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

ESLint 9.39.1 mit den empfohlenen JavaScript- und TypeScript-Regeln (typescript-eslint 8.72.0) sowie Prettier 3.6.2 sind als exakte Entwicklungsabh?ngigkeiten installiert. Die vorhandene Prettier-Konfiguration wird verwendet. Zus?tzlich pr?ft scripts/check-source.mjs Syntax, Konfliktmarker, debugger, fokussierte/?bersprungene Tests und Serverimporte im Browsercode.

Der Altbestand aus Commit 0166768 ist in evidence/lint-baseline.json und evidence/format-baseline.json ausdr?cklich erfasst: Lint-Ausnahmen gelten nur f?r vorhandene Regel-/Meldungs-/Codekombinationen und deren Anzahl; Format-Ausnahmen nur f?r unver?nderte Dateiinhalte. Neue Lint-Verst??e scheitern, neue oder ge?nderte Dateien m?ssen vollst?ndig formatiert sein. Windows-Zeilenenden werden f?r den Formatvergleich normalisiert. CI erweitert die Baselines nicht automatisch. Historische Migrationen und importierte Assets bleiben ?ber bestehende Hash-Pr?fungen gesch?tzt. Die Bereinigung verbleibender Altbefunde erfolgt separat.

Die Sicherheitsbewertung steht in [phase-5-security.md](phase-5-security.md). Das Werkzeugupdate beseitigt die sechs zun?chst zus?tzlich eingef?hrten Meldungen; die verbleibenden 82 betroffenen Paketeintr?ge betreffen bereits zuvor vorhandene Versionen. Ein gr?nes Funktionsgate ist keine Sicherheitsfreigabe.

## Lokale Nachweise

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
