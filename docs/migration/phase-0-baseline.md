# Phase 0 – Ausgangszustand und Abnahmeumfang

Datum: 21.10.2026 (Europe/Warsaw; Rohlogs teilweise 20.10.2026 UTC).

## Ergebnis und Grenze

Die Bestandsaufnahme ist dokumentiert. Ausgangsstände, Funktionsumfang, Rollenbefund, Szenarien und Fehlerliste sind festgehalten. Es wurden keine fachlichen Implementierungen, Migrationen, Seeds oder Datenbankänderungen durchgeführt. Phase 1 wurde nicht begonnen.

**Gate 0 ist mit dokumentierten Prüflücken erreicht, nicht als grüner technischer Ausgangszustand.** Saubere Neuinstallation und vollständige Laufzeittests sind in dieser Umgebung nicht nachgewiesen. Die fehlenden Prüfungen sind vor einer Freigabe des späteren Umzugs nachzuholen; ein erfolgreicher lokaler Build mit vorhandenen Paketen ersetzt sie nicht.

## Git und Arbeitsverzeichnisse

| Eigenschaft | Frontend | API |
| --- | --- | --- |
| Repository | `https://github.com/ChroniX6x/tobu-finance.git` | `https://github.com/ChroniX6x/tobu-finance-api.git` |
| Ausgangsbranch | `develop` | `develop` |
| Ausgangscommit | `a78318bd580eaa49a969fafb61bfdf9813e4316b` | `de86928927d50559ace525796aff64ae0012815e` |
| Letzter Commit | Merge `feature/planning` in `develop` | Merge `feature/planning` in `develop` |
| Status vor Prüfung | sauber, 10 Commits vor lokalem `origin/develop` | sauber, 7 Commits vor lokalem `origin/develop` |
| Sicherungsbranch | `baseline/pre-monorepo-2026-10-21` | `baseline/pre-monorepo-2026-10-21` |

Remote-Abstände beruhen auf vorhandenen Remote-Tracking-Refs, nicht auf einem frischen Fetch. Es wurde nichts gepusht. Die neu hinzugekommene Planungsfunktion ist Teil der Baseline und muss erhalten bleiben.

Lockfile-SHA256 zur Wiedererkennung des Prüfstands:

- Frontend `yarn.lock`: `94D27EC7066BC24F95F983DC626E6E724F20A4D2CEA39A1E9896B450CDAFCF16`.
- API `package-lock.json`: `15E3CD2132810BFBD8207B8B6528F5861BFAC161C7B3BFD6B3BAD4D08BC66921`.

- Transformationsbranch: `chore/monorepo-migration` im separaten Worktree `C:\GitRepos\tobu-finance-migration`.
- API-Prüfcheckout: `C:\GitRepos\tobu-finance-api-baseline`, detached HEAD auf dem Ausgangscommit.
- Ursprüngliche Arbeitsverzeichnisse bleiben auf `develop`.
- Temporäre Build-/Diagnoseartefakte: `C:\GitRepos\tobu-phase0-evidence`; temporärer npm-Cache: `C:\GitRepos\.tobu-phase0-cache`.
- Im Transformationsworktree verweist das ignorierte `node_modules` für Diagnosen auf die vorhandene Frontendinstallation. Dies ist ausdrücklich keine erfolgreiche Neuinstallation und keine Zielkonfiguration. Vor einer späteren Workspace-Installation den Link kontrolliert entfernen, ohne sein Ziel zu löschen.

## Laufzeit- und Werkzeugbestand

| Werkzeug | Beobachtung |
| --- | --- |
| Node | 24.13.1 |
| npm | 11.8.0 |
| TypeScript | 5.9.3 in beiden bestehenden Installationen |
| Angular Core / CLI | 21.2.0 / 21.2.0 installiert |
| Playwright | 1.58.2 installiert |
| Mongoose | 8.19.1 installiert |
| MongoDB Node-Treiber | 6.20.0 in API installiert |
| Zod | 4.1.12 installiert |
| Native MongoDB | `mongod --version`: 8.2.2; Binary unter `C:\Program Files\MongoDB\Server\8.2\bin` |
| Yarn | Nicht im PATH; Lockfile ist Yarn Classic v1; Corepack vorhanden, Download scheitert mit EACCES |
| Docker | Weder im PATH noch am geprüften üblichen Docker-Desktop-Binarypfad verfügbar |
| GitHub CLI | Nicht im PATH; GitHub-Einstellungen wurden nicht remote geprüft |

Die installierte Angular-Version akzeptiert laut lokalem Paketmanifest Node 24.13.1. Die Versionsangaben sind Beobachtungen, keine Aussage über neueste Releases. Für die spätere Containerumgebung dient MongoDB 8.2.2 zunächst als Vergleichsstand zur bestehenden lokalen Installation. Eine endgültige Image-Version wird erst nach Verfügbarkeit des Images und bestandenem Integrationstest mit dem festgelegten Treiber gepinnt. Ein getestetes Containerimage liegt in Phase 0 noch nicht vor.

## Prüfungen und Reproduzierbarkeit

Die vollständigen vorhandenen Installationen wurden nicht neu installiert oder verändert. API-Buildausgaben wurden in ein separates Diagnoseverzeichnis geschrieben. Bestehende `.env`-Dateien wurden nicht gelesen oder übernommen.

| Prüfung | Durchführung | Ergebnis |
| --- | --- | --- |
| API-Neuinstallation | `npm ci --offline --ignore-scripts --no-audit --no-fund --cache C:\GitRepos\.tobu-phase0-cache` im isolierten Checkout | Abgebrochen: `ENOTCACHED`, u. a. Zod-Tarball fehlt. Auch Lifecycle-Skripte/native Module wären damit noch nicht geprüft. |
| Frontend-Neuinstallation | Verfügbarkeit via `corepack yarn --version` geprüft | Yarn nicht verfügbar; Registryzugriff `EACCES`. Frozen-Lockfile-Installation konnte nicht ausgeführt werden. |
| API-Manifest/Lockfile | Root-Dependencies und DevDependencies maschinell verglichen | Keine Versionsbereichsabweichungen gefunden; ersetzt keine Installation. |
| Web-Anwendungstypen | `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` | Exit 0 mit bestehenden Paketen. |
| Web-Testtypen | Gleicher Compiler mit `-p tsconfig.spec.json` | Exit 2: veralteter Import `async` aus `@angular/core/testing`. |
| Web-Produktionsbuild unverändert | `node node_modules/@angular/cli/bin/ng.js build --configuration production --output-path <Diagnosepfad>` | Exit 127: konfiguriertes Yarn fehlt. |
| Web-Produktionsbuild diagnostisch | Im separaten Worktree ausschließlich `cli.packageManager` vorübergehend auf npm gesetzt; gleiche Buildoptionen | Exit 0, einschließlich Angular-Templateprüfung. Warnungen: Monatsansicht-SCSS 5,80 kB statt 4-kB-Warnbudget, CommonJS lodash, fehlendes `C:\layout\styles\preloading.css`. Änderung anschließend zurückgenommen. |
| Web-Unit-Tests unverändert | `ng test --watch=false --browsers=ChromeHeadless` über lokale CLI | Exit 127: Yarn fehlt. |
| Web-Unit-Tests diagnostisch | Derselbe Testlauf mit vorübergehender npm-Einstellung | Exit 1 bereits beim Kompilieren wegen `async`; keine Unit-Tests ausgeführt. |
| API-Build | `node node_modules/typescript/bin/tsc -p . --outDir <Diagnosepfad>` | Exit 2, 85 TypeScript-Diagnosen. Datei-/Fehlerliste siehe `evidence/api-typescript-errors.txt`. |
| API-Artefaktstart | Emittiertes JavaScript mit `type: module` und Zugriff auf bestehende Dependencies, ohne `.env` | Exit 1: `ERR_MODULE_NOT_FOUND` für `src/db` aus `server.js`, bevor DB-Verbindung/Bootstrap möglich werden. Emission trotz Buildfehlern ist kein gültiger Produktionsbuild. |
| API-Tests | package.json und Dateibestand | Kein API-Testskript/Testframework eingerichtet. |
| Playwright-Inventar | `node node_modules/@playwright/test/cli.js test --project=chromium --list` | 50 Tests in 6 Dateien erkannt. |
| Mock-E2E | Diagnostische npm-Einstellung, `--project=chromium --workers=1 --max-failures=2` | Zwei Tests scheitern unmittelbar, danach Max-Failures-Abbruch; Teardown bleibt hängen und wird per Ctrl+C beendet (Exit 1). Separater Browser-Launch bestätigt fehlendes Chromium-Binary. Keine erfolgreichen UI-Assertions nachgewiesen. |
| Real-API-E2E | Nicht gestartet | Keine isolierte eingerichtete Test-API/Testdatenbank und Testnutzer vorhanden; bestehende persönliche Entwicklungsdaten wurden nicht verwendet. |

Neuinstallationen bleiben als Prüflücke bestehen. Nach Bereitstellung des Paketnetzzugangs: Yarn Classic verfügbar machen, Web mit `yarn install --frozen-lockfile` im sauberen Checkout prüfen; API mit regulärem `npm ci` einschließlich Lifecycle-Skripten prüfen. Danach dieselben Build-/Testchecks wiederholen. Für Phase 2 einen überprüften npm-Lockfile-Übergang erstellen, nicht aus dieser Diagnoseinstallation ableiten.

Der gesonderte Playwright-Check `chromium.launch({headless:true, timeout:10000})` meldet das fehlende `chromium_headless_shell-1208`-Binary. Das ist ein Umgebungsblocker; die beiden frühen Testfehler ohne vollständigen Abschlussreport werden nicht als fachliche Regression gewertet. Die im E2E-Log identifizierten gestarteten Node-Serverprozesse waren nach Abbruch nicht mehr vorhanden. Die temporäre Angular-Änderung wurde mit Git zurückgenommen.

## Priorisierte Ausgangsbefunde

| ID | Befund | Behandlung |
| --- | --- | --- |
| B01 | API: 85 TS-Diagnosen, u. a. Mongoose-Modellunionen, undefinierte Werte, Planungsroute, Skripte und `ReliableBalance.currentMonthIso` | Phase 1: Ursachen beheben; keine Abschaltung der Typprüfung. |
| B02 | API-JavaScript lädt extensionlose relative ESM-Imports nicht | Phase 1: vollständigen Artefaktstart herstellen und prüfen. |
| B03 | Angular-Tests importieren entfernte Testfunktion `async`; App-Test erwartet außerdem statisch `Hello, tobu-finance` | Phase 1: Tests an tatsächliche Funktion anpassen; Titelprüfung ist bisher nur statisch als verdächtig identifiziert. |
| B04 | Neuinstallation/Yarn/Browserwerkzeuge und Docker derzeit nicht vollständig verfügbar | Umgebungsblocker getrennt von Codefehlern behandeln. |
| B05 | DTO für Buchungserstellung schließt `month` aus, Backend fordert Monat bei fehlendem Buchungsdatum | Phase 4: gemeinsam abbilden, Pilot-Vertragstest. |
| B06 | Kontozugriffsprüfung uneinheitlich; nur Summary benutzt in den geprüften Fachrouten `req.user` | Eigenen Berechtigungsbefund festhalten, Zielregel mit Nutzer klären; keine neue Rollenpolitik in Phase 0. |
| B07 | Real-API-Projekt ist kein Beweis für vollständig echte API-Tests: CRUD-Testdatei enthält eigene unbedingte `page.route(...route.fulfill...)`-Mocks | Phase 1/5: Mock- und Realtests tatsächlich trennen; im Realmodus keine verdeckten Antwort-Mocks zulassen. |
| B08 | Aktueller Seed droppt Collections; alter Reset startet Seed plus historische Migrationen | Nicht ausführen; Phase 3 ersetzt diesen Weg durch geschützte Baseline/Seeds. |
| B09 | Arbeitsverzeichnispfade, Windows-Startsyntax, festes `D:\mongodb\db`, API-URL localhost:4000 | Phase 2/3: zentralisieren, plattformübergreifend machen. |
| B10 | Keine versionierten GitHub-Actions-Workflows in beiden Repositories gefunden | CI-Aufbau später; Remote-Branchschutz, Secrets und Webhooks unbekannt. |
| B11 | Web-Buildwarnungen für CSS, CommonJS und Stylesheetpfad | Vorhandene Warnungen dokumentiert; gezielt bewerten statt als Transformationsregression zählen. |

## Start- und Integrationsinventar

- Frontend-VS-Code-Tasks rufen npm `start` und `test` auf. Angular startet separat auf Port 4200.
- API-VS-Code-Tasks `start:dev` / `start:dev:debug` starten `mongod` und API parallel, ohne Datenbankbereitschaft abzuwarten.
- `npm run dev` der API führt zuvor `init:env` aus, das Konfiguration/Schlüssel schreiben kann. Deshalb im Bestandsverzeichnis nicht für diese Phase ausgeführt.
- API-Port standardmäßig 4000, Auth per Bearer-Token und Refresh-Cookie. Health/OpenAPI öffentlich, `/api` zentral authentifiziert, `/api/auth` ausgenommen.
- Keine weiteren API-Verbraucher nach Nutzerangabe. Kein Livebetrieb; keine Alt-Datenübernahme nötig.
- Keine Docker-/Deployment-Konfiguration oder CI-Workflows im geprüften versionierten Bestand gefunden. Remote-GitHub-Einstellungen nicht verifiziert und nicht verändert.

## Rollen und tatsächlich sichtbare Grenzen

| Variante | Beobachtung im Code | Geplanter Testnutzer |
| --- | --- | --- |
| Auth-Rolle `user` | Default im Modell und bei Registrierung; beliebige Strings technisch speicherbar, keine belastbare zusätzliche Rolle festgestellt | Aktiver Basisnutzer |
| Kontorolle `owner` | Mitgliedschaft in Account; Schutz gegen Entfernen des letzten Owners vorhanden | Kontoinhaber |
| Kontorolle `member` | Mitgliedschaft; keine durchgehende Schreibrechteabgrenzung gegenüber owner festgestellt | Mitglied desselben Kontos |
| Ohne Kontozuordnung | Summary filtert über Member.userId; generische Kontorouten filtern nicht entsprechend | Separater Nutzer ohne Konto |
| Deaktivierter Nutzer | Login und Refresh prüfen `isActive`; Access-Middleware prüft JWT, nicht aktuellen Aktivstatus in DB | Deaktivierter Testnutzer |

`requireRole` ist definiert, aber kein aktiver Aufruf in den untersuchten Fachrouten gefunden. Die Prüfungen in `accounts.ts` schützen unter anderem Datenkonsistenz/letzten Owner; sie belegen keine Berechtigung des aufrufenden Nutzers. Das ist ein statischer Befund, noch kein ausgeführter Negativtest.

**Offene fachliche Frage:** Dürfen nur Owner Stammdaten/Mitglieder verwalten oder bleiben Owner und Member gleichberechtigt? Rückfrage wurde gestellt. Bis zur Entscheidung keine entsprechende Implementierung und keine erfundene Admin-Rolle. Unabhängig davon muss der erwartete Umgang mit fremden Konten ausdrücklich als Zugriffstest definiert werden.

## Historische Datenbankentwicklung

| Datei | Durch Namen/Quellcode identifizierter Zweck |
| --- | --- |
| `20250813-reshape_schema.ts` | Umformung des alten Datenmodells, Indizes/Validatoren, Backup-/Rename-Schritte |
| `20250820_add_settings_events.ts` | Kontoeinstellungen und Events sowie begleitende Daten-/Validatoränderungen |
| `20251009_rename_cents_to_minor.ts` | Umbenennung von Cent-Feldern in Minor-Unit-Felder |
| `20260222_seed_default_users.ts` | Initiale Nutzer; spätere Seeds trennen solche Demodaten von der Baseline |
| `20260224_transactions_phase0.ts` | Buchungsmodell einschließlich Split-/Statusentwicklung und Backupregistrierung |

`src/migrations/lib/backupRegistry.ts` gehört beim Archivieren dazu. Die Archivierung selbst erfolgt erst in Phase 3. Aktuelle Umzug-Globs müssen dann ausschließlich auf neue aktive Migrationen zeigen. Für die Baseline Indizes aus aktuellen Mongoose-Modellen und historische DB-Validatoren abgleichen, insbesondere eindeutige Salden-/Übertragsindizes, Nutzer-E-Mail und Session-TTL. Keine historischen Skripte gegen die bestehende Datenbank ausgeführt.

## Abnahmeumfang und nächste Freigabe

Die konkrete Szenariobasis steht in [phase-0-acceptance.md](phase-0-acceptance.md). Planung ist ausdrücklich Bestandteil des Umfangs. Die Daten sollen neu und synthetisch entstehen; bisherige `db.json`-Dateien und alte Seeds sind Referenzen, kein verbindlicher neuer Fixture-Vertrag.

Vor Beginn der nächsten Phase sind folgende Punkte sichtbar zu halten:

1. Nutzerfreigabe für Phase 1 abwarten; dieser Commit autorisiert keine Weiterarbeit.
2. Prüfumgebung für Paketinstallation und Browser vervollständigen; Docker spätestens für Phase 3 verfügbar machen.
3. Offene Rollenfrage beantworten oder als separates späteres Arbeitspaket festhalten.
4. Phase 1 behebt den technischen Ausgangszustand. Repository-Umzug und Baseline-Seeds erfolgen erst in den vorgesehenen späteren Phasen.

## Review dieses Dokumentationsstands

Vor dem Commit: Ausgangscommits/Branches, Prüflogs, Anzahl der API-Diagnosen, Dateidiff und unveränderte Original-Arbeitsbäume kontrollieren. Temporäre Angular-Konfiguration zurücknehmen. Nur Dokumentation und bereinigte Diagnoseauszüge versionieren. Keine `.env`, Zugangsdaten, persönlichen Datenbankinhalte oder Browser-Auth-States aufnehmen.

Planreferenz: [transformation-plan.md](transformation-plan.md) ist eine inhaltlich unveränderte Kopie des am 21.10.2026 unter `C:\GitRepos\docs` abgestimmten Plans (nachgestellte Leerzeichen der Datumszeile entfernt). Seine historischen Statusangaben beschreiben den Zeitpunkt der Planung; dieser Phase-0-Bericht dokumentiert den aktuellen Ausführungsstand. Die ursprüngliche Planungsdatei wurde nicht geändert.
