# Phase 1 – Technischen Ausgangszustand stabilisieren

Stand: 21.10.2026. Gate 1 bestanden: Die zuvor offenen Browserprüfungen wurden vom Nutzer im normalen Terminal erfolgreich bestätigt. Phase 2 wurde nicht begonnen.

## Branches und Herkunft

- Frontend: `C:\GitRepos\tobu-finance-migration`, Branch `chore/monorepo-migration`, auf Phase-0-Commit `1bfeae6`.
- API: `C:\GitRepos\tobu-finance-api-phase1`, Branch `chore/monorepo-phase-1`, Phase-1-Commit `f4b65f6`, basierend auf `de86928927d50559ace525796aff64ae0012815e`.
- Die ursprünglichen Entwicklungs-Checkouts bleiben unverändert. Keine Veröffentlichung oder Push. Der korrigierte API-Snapshot ist erst in Phase 2 zu importieren. Deshalb existiert für Phase 1 je ein Commit in den noch getrennten Repositories.

## Änderungen

Die API baut mit den bestehenden strikten TypeScript-Optionen unter NodeNext. Relative ESM-Imports, Mongoose-Modelltypen und optionale Werte wurden korrigiert. Build und Start sind plattformunabhängige Node-Skripte; OpenAPI wird in das Artefakt kopiert, Migrationen werden passend zum Quellcode beziehungsweise kompilierten JavaScript gefunden. Ein doppelter OpenAPI-Pfad verursachte zuvor einen YAML-Parserfehler und wurde entfernt. Details und Testbefehle stehen im API-Checkout unter `docs/phase-1-testing.md`.

Die veralteten Frontend-Unit-Tests prüfen jetzt die Auth-Initialisierung, den Router und das Laden/Umwandeln der Berechnungsdaten einschließlich Fehler-Fallback. Playwright trennt Mock-Spezifikationen von echten API-Spezifikationen. Nur das echte API-Projekt benötigt Login-Zugangsdaten; fehlende Angaben führen zu einem klaren Fehler. Der neue Session-Test enthält keine Request-Mocks. `PLAYWRIGHT_CHANNEL=chrome` erlaubt optional installiertes Chrome.

## Prüfungen und tatsächliche Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| API Typecheck / Produktionsbuild | Erfolgreich, ursprüngliche 85 TypeScript-Fehler behoben |
| API Unit-Tests | 5 bestanden |
| API Integration | 8 Teiltests plus übergeordneter Test bestanden; gebautes JavaScript, eigene RSA-Schlüssel, temporäre MongoDB 8.2.2 |
| Angular Produktionsbuild | Erfolgreich mit den unten genannten bestehenden Warnungen |
| Frontend-Test-TypeScript und Playwright-Konfiguration | Erfolgreich geprüft |
| Angular Unit-Tests | Nutzer bestätigt 4 erfolgreiche Tests im normalen Terminal |
| Playwright Mock-Oberfläche | Nutzer bestätigt 50 erfolgreiche Tests im normalen Terminal |
| Echter Browser gegen echte API | Nutzer bestätigt 2 erfolgreiche Tests (Login-Setup und Session-Test) aus Schritt 4 der Prüfanleitung |
| Frische Dependency-Installation / Docker | In dieser Agentenumgebung nicht nachgewiesen |

Die API-Integration prüft Registrierung, doppelte Registrierung, ungültigen Login, fehlende/ungültige Tokens, inaktive Nutzer, Refresh-Rotation, Logout, Member/Konten und vollständiges Buchungs-CRUD. Weitere Leseendpunkte werden auf Erreichbarkeit geprüft; dies ist kein umfassender fachlicher Zahlenvergleich. Testdaten werden unabhängig vom Entwicklungsbestand erzeugt und anschließend entfernt. Historische Migrationen/Seeds wurden nicht ausgeführt.

Die Browserdiagnose verwendete vorhandene Abhängigkeiten per lokalem `node_modules`-Verweis und System-Chrome. Die ursprüngliche Yarn-Konfiguration war während Build/Tests temporär auf npm gestellt, weil Yarn im Agentenkontext nicht zugänglich ist. Für Playwright wurden Videos temporär deaktiviert, da das erforderliche FFmpeg nicht zugänglich ist. Beide Einstellungen wurden danach zurückgesetzt. Der normale Karma-Chrome-Launcher scheitert hier am GPU-Prozess; der Diagnoseweg mit manuell verbundenem Chrome führte alle vier Assertions aus. Diese Hilfseinstellungen ersetzen keinen regulären Lauf im normalen Benutzerterminal.

Bestehende Build-Warnungen: Month-View-CSS 5,80 kB bei 4-kB-Warnschwelle, CommonJS-Abhängigkeit `lodash`, fehlendes `/layout/styles/preloading.css`. Sie sind nicht als behoben gewertet. Rohprotokolle liegen lokal unter `C:\GitRepos\tobu-phase0-evidence\phase1-*.log`.

## Abschlussbestätigung und Wiederholung der Prüfungen

Der Nutzer meldete zunächst „4 erfolgreiche unit test und 50 erfolgreiche playwright test“ und anschließend für Schritt 4 „2 test erfolgreich“. Diese Rückmeldungen ergänzen die bereits erfolgreichen Build- und API-Prüfungen und schließen die offenen Gate-1-Browserprüfungen. Die Bestätigung beruht auf den Nutzerangaben; zusätzliche Rohprotokolle oder einzelne Exitcodes wurden nicht übermittelt. Die zuvor beschriebenen Einschränkungen betreffen die Agentenumgebung und bleiben als Diagnosehistorie dokumentiert. Ein frischer Checkout mit Installation sowie die Docker-Orchestrierung werden in den vorgesehenen späteren Gates geprüft.

Im normalen Benutzerterminal mit den eingerichteten Downloads:

```powershell
cd C:\GitRepos\tobu-finance-migration
npx ng build
npx ng test --watch=false --browsers=ChromeHeadless
npx playwright test --project=chromium
```

Der echte Browser-Test benötigt eine separat gestartete API mit isolierten Testdaten und konfiguriertem Testbenutzer sowie das bestehende Frontend-API-Ziel auf diese API. Dann `E2E_EMAIL`, `E2E_PASSWORD` und gegebenenfalls `API_BASE_URL` setzen und `npx playwright test --project=chromium-real-api` ausführen. `API_BASE_URL` steuert den Setup-Login, nicht automatisch die API-Konfiguration der Angular-Anwendung. Auth-State-Dateien bleiben ignoriert und dürfen nicht eingecheckt werden.

Ein frisches `npm ci` ist in einem eigenständigen Checkout zu verifizieren, nicht über die hier verwendeten `node_modules`-Verweise. Die Vereinheitlichung auf npm und ein Root-Lockfile bleibt Aufgabe von Phase 2. Docker-Orchestrierung und ein gemeinsamer Startbefehl bleiben Aufgabe von Phase 3.

## Korrektur zur Rollen-Bestandsaufnahme

Das alte API-Skript `scripts/link-users-to-members.ts` enthält bereits globale Rollen `user` und `admin`; die Phase-0-Annahme, es gebe keine zusätzliche Admin-Rolle, ist damit zu korrigieren. Daneben existieren kontobezogene Rollen `owner` und `member`. Die Nutzerentscheidung „nur Admins dürfen Mitglieder erstellen/einladen“ bleibt verbindlich. Vor ihrer Implementierung muss die Abgrenzung globaler Admin gegenüber Kontoeigentümer eindeutig feststehen. Phase 1 ändert die Berechtigungen nicht; die bestehenden CRUD-Tests sind kein Nachweis der künftigen Admin-Regel.

Nach diesem Phase-1-Stand auf weitere Anweisungen warten. Keine automatische Fortsetzung mit dem Workspace-Umzug.
