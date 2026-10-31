# Entwicklung ab Phase 3

Voraussetzungen: Node 24.13.1, npm 11.8.0, Docker mit Compose und laufender Linux-Engine. Windows/VS Code ist der primäre Prüfpfad; die Node-Skripte unterstützen auch Linux/macOS. Keine native MongoDB-Installation nötig. MongoDB ist für Entwicklung und Tests auf **mongo:9.0.4** festgelegt (auf Nutzerwunsch neueste veröffentlichte Version, geprüft am 21.10.2026 anhand der [offiziellen Image-Liste](https://github.com/docker-library/docs/blob/master/mongo/README.md)). Die Freigabe dieser Kombination erfolgt über Gate 3, nicht allein durch den Download.

## Erstes Setup

Ab der Erweiterung für sichere Migrationen läuft lokale Docker-MongoDB als Single-Node-Replica-Set. Bei einem bereits vorhandenen Standalone-Volume zuerst die [Umstellung mit geprüfter Sicherung](database/migration-progress.md) durchführen. `setup`/`dev` verweigern eine ungeprüfte Übernahme. Neue leere Installationen und reguläre Neustarts initialisieren das Replica Set automatisch. Der aktive Migrationsrunner unterstützt transaktionale und kontrollierte strukturelle Änderungen; Einstieg und Nachweise stehen im [Migrations-Handover](database/migration-handover.md).

Im Repository-Root:

```powershell
npm ci
docker pull mongo:9.0.4
npm exec --workspace=@tobu/web -- playwright install chromium
npm run setup
npm run dev
```

Für die Angular-Unit-Tests zusätzlich Chrome installieren. `setup` legt fehlende `.env`-Dateien an, ergänzt fehlende Werte und erzeugt lokale RSA-Schlüssel. Vorhandene Werte und Schlüssel bleiben erhalten. Ein fehlender öffentlicher Schlüssel wird aus dem privaten abgeleitet; widersprüchliche Schlüssel führen zum Abbruch. Keine Systemsoftware wird automatisch installiert.

`setup` startet die ausgewählte Datenbank, initialisiert die Baseline und ergänzt einmalig die Demo. Wiederholtes Setup prüft den Stand; es ersetzt keine manuell geänderten Daten und füllt eine bereits abgeschlossene Demo nicht automatisch erneut auf. `dev` prüft Ports, Docker/DB und Baseline, startet die API, wartet auf `/ready` und startet anschließend Angular. Es führt keine Seeds oder Schemaänderungen aus.

Web: <http://localhost:4200>, API-Readiness: <http://127.0.0.1:4000/ready>, OpenAPI: <http://127.0.0.1:4000/docs>. Angular leitet relative `/api`-Aufrufe an die API weiter. Login, Refresh und Logout nutzen dadurch dieselbe Browser-Origin. Der HttpOnly-Refresh-Cookie gilt für `/api/auth`, damit er auch beim Logout mitgesendet wird.

## Täglicher Betrieb und Datenpersistenz

Docker Desktop starten, dann `npm run dev`. Änderungen an API und Web werden beobachtet. `Ctrl+C` beendet die von diesem Start erzeugten API-/Web-Prozesse. MongoDB bleibt verfügbar. `npm run dev:down` stoppt MongoDB und behält das benannte Volume `<COMPOSE_PROJECT>_mongo-data`.

Manuell erstellte Testdaten bleiben nach Containerstopp, Windows-Neustart und erneutem `npm run dev` vorhanden. Sie liegen im Volume, nicht im kurzlebigen Container. `docker compose down -v`, manuelles Löschen des Volumes oder der explizite DB-Reset löschen diese Daten. Ein anderer Projektname verwendet ein anderes Volume; die alten Daten sind dann nicht automatisch im neuen Projekt sichtbar.

Die native MongoDB samt altem Datenverzeichnis bleibt unberührt. Der Docker-Standardport ist 27018 und kollidiert daher nicht mit einer nativen Instanz auf 27017. Datenverzeichnisse älterer MongoDB-Versionen werden nicht als Volume eingebunden. Wenn bereits ein Entwicklungsvolume mit einer anderen Hauptversion existiert, zuerst dessen Version/Daten prüfen; diese Phase sieht einen frischen Aufbau vor und führt kein automatisches Major-Upgrade durch.

## Konfiguration

Root-`.env` ist die zentrale Entwicklungssteuerung. Prozess-Umgebungsvariablen überschreiben diese Werte. `apps/api/.env` enthält lokale API-Schlüssel; der Root-Runner setzt DB-URI, API-Port, Host und CORS gezielt aus der Root-Konfiguration.

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| DB_MODE | docker | docker oder ausdrücklich external |
| DB_PORT | 27018 | Nur an 127.0.0.1 veröffentlichter MongoDB-Port |
| DEV_DB_NAME | tobu_finance_dev | Name der Docker-Entwicklungsdatenbank |
| COMPOSE_PROJECT | tobu-finance-dev | Bestimmt Container und persistentes Volume |
| API_PORT / WEB_PORT | 4000 / 4200 | Müssen frei und verschieden sein |
| MONGODB_URI | leer | Nur im externen Modus erforderlich |
| SEED_MONTH | leer | Beim ersten Seed aktueller UTC-Monat; danach gespeichert |

Eine bewusst gewählte eigene Datenbank lässt sich mit `DB_MODE=external` und einer expliziten `MONGODB_URI=mongodb://127.0.0.1:27017/tobu_neu` verwenden. Nur eine neue/leere Datenbank oder eine bereits bekannte Baseline wählen. Der Runner startet/stoppt diesen Server nicht. Eine nicht erreichbare externe DB führt zum Fehler, niemals zum Wechsel auf Docker. Docker bleibt für isolierte Tests erforderlich.

Fehler bei belegten Ports werden vor dem Stackstart gemeldet. Fehlende Docker-Engine, unerreichbare Datenbank, fehlende Baseline oder ausgefallene Prozesse beenden den Start mit Fehler. `/health` ist nur Liveness; `/ready` prüft DB-Erreichbarkeit und Baseline-Marker. Der Runner prüft beim Start zusätzlich Indizes und Validatoren. Vollständige Rechteprüfung ist davon unabhängig.

## Datenbankbefehle

| Befehl | Wirkung |
| --- | --- |
| npm run db:init | Baseline auf leerer DB erzeugen oder vorhandenen Stand prüfen; keine Demo |
| npm run db:replica:init -- --writers-stopped=tobu_finance_dev | Bekannte lokale Standalone-DB nach Backup und Restore-Probe auf Replica Set umstellen; alle Writer müssen beendet sein |
| npm run db:seed | Fehlende Demo-Dokumente ergänzen; bestehende Dokumente unverändert lassen |
| npm run db:migrate:plan | Ziel, ausstehende Migrationen und Bestätigungshash lesen |
| npm run db:migrate -- --confirm=HASH --writers-stopped=tobu_finance_dev | Bestätigte transaktionale Up-Migrationen bei gestoppten Writern ausführen; siehe [Anleitung](database/migration-authoring.md) |
| npm run db:reset -- --confirm=tobu_finance_dev | Bewusst ausschließlich die Docker-DB tobu_finance_dev löschen und neu aufbauen |

Das rein lesende Kalender-Audit (H05) läuft mit explizitem `MONGODB_URI` über `node --import tsx apps/api/src/database/cli.ts audit-calendar` (im Verzeichnis `apps/api`, gebaut: `node apps/api/dist/src/database/cli.js audit-calendar`). Es gibt nur aggregierte Zähler als JSON auf stdout aus und schreibt nichts. Entscheidung `NO MIGRATION` (keine blockierenden oder tolerierten Befunde; reine Info-Befunde zu Legacy-Recurrences erlaubt), `REVIEW` (tolerierte Altwerte, Entscheidung durch den Eigentümer nötig) oder `STOP-DATA` (Exit-Code 2, keine Migration ohne eigenen freigegebenen Plan).

Reset ist im externen Modus und ohne die exakte Bestätigung gesperrt. Die Entwicklungsbefehle sind bei `NODE_ENV=production` gesperrt. Einen anderen Referenzmonat nur mit bewusstem Reset wählen. Gelöschte Seed-Dokumente können durch `db:seed` wieder ergänzt werden; eine manuell geänderte vorhandene Buchung wird dabei nicht ersetzt.

## Demo-Nutzer und Szenarien

Passwort für alle Demo-Nutzer: `Tobu-Demo-2026!`. Nur für lokale Entwicklung. E-Mail: `<name>@demo.tobu.test`.

| Name | Vorbereitung |
| --- | --- |
| admin | Globaler Admin ohne Kontomitgliedschaft |
| admin-owner | Admin, Owner seines eigenen Kontos und Mitglied im Haushalt |
| alice | Owner von leerem Konto, Einzelhaushalt, Haushalt, Null-Einkommen und 60/40-Konto |
| bob | Mitglied mehrerer Konten, Teilzahlung/private Vorleistung |
| chris | Mitglied ohne Einkommen im Drei-Personen-Konto |
| outsider | Owner eines separaten fremden Kontos |
| new | Aktiver Nutzer ohne Mitglied/Konto |
| blocked | Gesperrter Nutzer, Konto und Historie bleiben erhalten |

Diese Zuordnungen bereiten die vereinbarte [Rechtematrix](migration/roles-and-access.md) vor. Phase 3 implementiert **keine vollständige Kontozugriffskontrolle**. Insbesondere ist die gewünschte Trennung zwischen globalem Admin und privaten Finanzdaten noch kein bestandenes Sicherheitsmerkmal. Keine echten Finanzdaten in die Demo übernehmen.

`M` bezeichnet den in `_tobu_seed` gespeicherten Referenzmonat. Bei älteren Seeds diesen Monat in der UI wählen. Alle Geldwerte unten sind Cent; stabile IDs werden aus `tobu-demo-v1:<Kennung>` abgeleitet.

| Kennung / Konto | Manuell prüfbare Ausgangslage und Erwartungswerte |
| --- | --- |
| account:empty / 01 | Alice; drei Kategorien, keine Buchungen, Salden oder Beiträge: Leerzustände |
| account:solo / 02 | Ein Mitglied; Einkommen 200000, Grundbeitrag 30000, Historie M-6 bis M |
| account:household / 03 | Einkommen Alice/Bob/Admin 200000/100000/0; Grundbeitrag 30000 verteilt 20000/10000/0 |
| Beiträge / 03 | Alice bezahlt 20000 vollständig; Bob bezahlt 5000 teilweise, offen 5000; Übertrag Bob separat 2500 |
| Budgetvergleich / 03 | Lebensmittelbudget 10000; Ausgaben M-2: 8000, M-1: 10000, M: 12000 |
| Vormerkung / 03 | M+1: 3500 vorgemerkt, Buchungsdatum null |
| Private Vorleistung / 03 | Bob zahlt 1750 aus eigenen Mitteln |
| Teilzuordnung / 03 | Elternbuchung 10000, Kinder 3000+2000: Rest 5000 |
| Vollzuordnung / 03 | Elternbuchung 10000, Kinder 6000+4000: Rest 0 |
| Suche & Pagination / 03 | 65 Buchungen, Beträge 101 bis 165; Summe 8645, Kategorie Sonstiges ohne Budget |
| Wiederkehrend / 03 | Monatliche Mietvorlage 90000, nächster Termin M+1; keine automatische Ausführung beim Start |
| Einzelbeitrag / 03 | Einmaliger Zusatzbeitrag Bob 12500 in M+1, Verteilung perMember |
| account:zero / 04 | Drei Mitglieder ohne Einkommen, offener Grundbeitrag 10000; Gleichverteilung mit Centrest 3334/3333/3333 |
| account:custom / 05 | 60/40 von 10001: 6001/4000; letzter Saldenstand M-3, Lücken danach |
| account:admin, foreign, blocked / 06–08 | Rollen-/Zuordnungsfälle; gesperrter Owner behält Historie |

Salden sind bewusst eigene Snapshot-Beispiele, keine aus sämtlichen Beispielbuchungen rekonstruierte Bankhistorie. Der vollständige Verlauf hat in M den Saldo 290000; das lückenhafte Konto zuletzt 245000 in M-3. Die Baseline enthält keine Demo-Nutzer. Automatisierte API-/Browser-Tests erstellen eigene minimale Fixtures in zufälligen Datenbanken statt die manuelle Demo umzuschreiben.

## VS Code und Produktion

VS Code am Repository-Root öffnen. Task „ToBu: Setup“ einmalig; „ToBu: Start“ täglich. „ToBu: API + Stack“ startet denselben Stack mit Inspector an 127.0.0.1:9229 und hängt den Debugger an. Das Beenden des angehängten Debuggers beendet nicht automatisch den Task: im Task-Terminal `Ctrl+C` verwenden. Browser-Debug verwendet standardmäßig Port 4200; bei abweichendem WEB_PORT die URL anpassen.

`npm run build` erstellt API- und Web-Artefakte. Produktiv werden Umgebungsvariablen und Schlüssel vom Deployment bereitgestellt, insbesondere MONGODB_URI, NODE_ENV=production, CORS_ORIGIN und gegebenenfalls HOST=0.0.0.0. `npm run start:api` startet das gebaute JavaScript. Web-Hosting muss `/api` an die API weiterleiten; der Angular-Dev-Proxy wird nicht mitgebaut. Docker-Compose dieser Phase ist eine lokale Entwicklungsumgebung, kein Produktionsdeployment. Baseline-/Migrationsausführung im Deployment benötigt einen eigenen, geprüften administrativen Ablauf; die Entwicklungs-CLI bleibt dort absichtlich gesperrt.

## Gemeinsame API-Verträge

Siehe [Vertragsarchitektur](architecture/contracts.md). `npm run dev` baut und überwacht auch `@tobu/contracts`. Nach Schemaänderungen `npm run contracts:generate` und `npm run check:contracts` ausführen. Die vollständige Phase-4-Prüfung lautet `npm run verify:phase4`.

## Qualitätsprüfung und Artefakte

Die Integrationstests dürfen die Server-Uhr einfrieren: Mit `NODE_ENV=test` und `TOBU_TEST_NOW=<ISO-Zeitpunkt>` liefert `apps/api/src/lib/clock.ts` diesen Zeitpunkt. In jedem anderen Modus wird die Variable ignoriert; sie gehört nicht in `.env` oder ins Deployment. Damit werden Monatsgrenzen reproduzierbar getestet (siehe `apps/api/tests/integration/month-intervals.test.mjs`, drei API-Prozesse in verschiedenen Prozess-Zeitzonen).

Datum und Monat: Begriffe, Pflichten und der Status je Fundstelle stehen in [date-month-semantics.md](architecture/date-month-semantics.md). Server- und Browserzone für reale Läufe setzt man über die Umgebung, die `e2e:real` bis zur API und zum Spec weitergibt, z. B. PowerShell `$env:TZ='America/Los_Angeles'; $env:TOBU_TEST_NOW='2026-10-31T23:30:00.000Z'; npm run e2e:real` (danach beide Variablen entfernen). Die Zonen-Specs (`calendar-cross-zone`, `calendar-flows`, `calendar-instants`, `calendar-qa.real`) laufen mit festen Browserzonen in `npm run e2e` bzw. `npm run e2e:real`. Wer einen Datums- oder Monatspfad ändert, ergänzt Tests in mindestens zwei Server- und zwei Browserzonen und führt das vollständige `npm run quality:full` aus. Rollout und Backout der Kalenderänderungen sind im Dokument beschrieben; eine Produktionsautomatik gibt es nicht.

Für die Mock-E2E gelten auf ausdrücklichen Nutzerwunsch 60 Sekunden pro Test und 15 Sekunden für wiederholte Assertions (zuvor 30/5 Sekunden). Erfolgreiche Schritte warten diese Budgets nicht ab. Parallelität und Videoaufzeichnung bleiben aktiv; fehlgeschlagene Tests behalten zusätzlich einen Trace, ohne automatische Wiederholungen. Der längere Real-API-CRUD-Test behält sein bestehendes 90-Sekunden-Budget. Die Wizard-Prüfungen verwenden das gemeinsame Assertion-Budget statt kürzerer lokaler Überschreibungen. Falls für einen Diagnoseversuch `$env:PLAYWRIGHT_VIDEO = "off"` gesetzt wurde, vor dem nächsten Lauf in PowerShell `Remove-Item Env:PLAYWRIGHT_VIDEO -ErrorAction SilentlyContinue` ausführen. Diese Zeitbudgets sind keine Garantie bei beliebiger Rechnerüberlastung.

`npm run quality` prüft Quellen, Typen, Verträge, Builds, Units und Mock-E2E. `npm run quality:full` (Alias `npm run verify:phase5`) ergänzt Docker-Integration, echte Browserabläufe, Start/Stop/Persistenz und eine saubere Produktionsinstallation. Docker und Paketdownloads müssen dafür verfügbar sein. Fehlende Voraussetzungen führen zu einem Fehler; der Bericht liegt in `test-results/quality.json`.

Chromium einmalig mit `npm exec --workspace=@tobu/web -- playwright install chromium` installieren.

`npm run test:web` (Karma, `ChromeHeadless`) wählt den Browser in dieser Reihenfolge:

1. ein explizit gesetztes `CHROME_BIN` (bleibt unverändert, auch wenn die Datei fehlt; Karma meldet das selbst);
2. ein installiertes System-Chrome an den Orten, die Karma selbst prüft (Windows: `Program Files`/`LOCALAPPDATA`; macOS: `/Applications`; Linux: `google-chrome` oder `google-chrome-stable` im `PATH`). Chromium zählt hier nicht, `ChromeHeadless` verwendet es nur über `CHROME_BIN`;
3. sonst automatisch das installierte Playwright-Chromium; der Lauf meldet das ausdrücklich.

Ohne jeden Browser warnt der Wrapper und Karma schlägt fehl; es wird nichts übersprungen. Manuell: PowerShell `$env:CHROME_BIN = (node -p "require('@playwright/test').chromium.executablePath()")`, Linux/Bash `export CHROME_BIN="$(node -p "require('@playwright/test').chromium.executablePath()")"`. Die CI setzt `CHROME_BIN` selbst (Linux: System-Chrome wegen Sandbox, Windows: Playwright-Chromium); Playwright installiert in Linux-CI zusätzlich die Systemabhängigkeiten mit `--with-deps`. Direkte Aufrufe von `npm run test:unit --workspace=@tobu/web` nutzen die Automatik nicht.

Playwright-Version und Upgrades:

- Das Projekt verwendet Playwright 1.61.0. Erst ab 1.61 kennt Playwright Ubuntu 26.04 (`ubuntu-latest`); ältere Versionen scheitern bei `playwright install --with-deps`.
- Playwright 1.64.1 (Chromium 156) wurde geprüft, ist aber vorerst nicht freigegeben: Karma-`ChromeHeadless` startet damit unter Windows mit der Standard-Sandbox nicht (nur mit `--no-sandbox`).
- Nach einem Playwright-Upgrade das passende Chromium neu installieren (der Befehl oben).
- Bewusste Upgrades gepinnter Basis-Abhängigkeiten stehen mit Datum und Grund in `docs/migration/evidence/approved-dependency-upgrades.json`. `npm run check:workspace` blockiert jede nicht dort freigegebene Abweichung. Änderungen an dieser Datei brauchen ein Review.

Der Umfang der Quellcode-/Formatprüfungen sowie offene Punkte stehen im [Phase-5-Bericht](migration/phase-5-results.md). Gebaute Pakete: `npm run build`, `npm run package:artifact`; siehe [Artefaktanleitung](production-artifact.md). Der dortige lokale Webserver liefert die gebauten Angular-Dateien mit API-Proxy aus; er ersetzt kein produktives Hosting.

## Strukturänderungen der Datenbank

Transaktionale Migrationen bleiben der Standard. Index-, Validator-, Collection- und größere Datenumbauten verwenden den bestätigten strukturellen Modus mit geprüftem Backup und Wiederherstellungsjournal. Siehe [Agent-Anleitung](database/migration-authoring.md) und [Betrieb/Recovery](database/structural-migrations.md). `dev` migriert oder restauriert niemals automatisch. Lokale Archive liegen unter `backups/migrations/`; Docker-Daten bleiben im bisherigen persistenten Volume.
