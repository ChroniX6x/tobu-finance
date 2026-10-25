# Sichere Migrationen: Umsetzungsstand

Stand: 25.10.2026. Architektur freigegeben. Branch: `feat/safe-database-migrations`. Abschnitte 1–3 sind implementiert; der Nutzer bestätigt die Tests aus Abschnitt 3 als erfolgreich. Abschnitt 4 ergänzt den Abschluss-Handover; GitHub-CI für den Abschluss-Commit ist separat zu bestätigen. Ältere Statusangaben unten dokumentieren den damaligen Stand.

## Abschnitt 1: feste Baseline und lokale Replica Sets

Implementiert, Docker-Abnahme noch offen:

- Historischer Snapshot `apps/api/src/database/baseline/2026-10-v1.json` ersetzt die dynamische Ableitung aus aktuellen Modellen. Initialisierung, Validator- und Indexprüfung verwenden diesen festen Stand. Kein Demo-Seed und keine historischen Migrationen wurden verändert.
- Compose und isolierte Testcontainer verwenden `tobu-local`. Bootstrap initialisiert nur ein noch nicht initialisiertes Set, wartet auf den Primary und lehnt abweichende Konfigurationen ab. Container-Neustarts erhalten das benannte Volume. Der Image-Pin bleibt 9.0.4.
- Nur lokale Docker-URIs erhalten `directConnection=true&replicaSet=tobu-local`. Externe URIs, insbesondere SRV und TLS, bleiben unverändert.
- Bestehende Standalone-Container werden beim normalen Start abgelehnt. Der explizite Umstellungsbefehl benötigt stillgelegte Writer, prüft zusätzlich freie API-/Web-Ports, Image, Volume und bekannten Baseline-Stand.
- Die Umstellung sichert die Anwendungsdatenbank mit `mongodump`, stellt sie in einem eigenen Testcontainer mit `mongorestore` wieder her und vergleicht BSON-Inhalte, Counts, Collection-Optionen, Validatoren und Indizes. Erst danach wird der ursprüngliche Container mit demselben Volume umgestellt. Nach der Umstellung wird erneut verglichen.
- Backups und Manifest liegen unter `backups/replica-set/`, außerhalb des DB-Volumes und von Git ausgeschlossen. Bei unterbrochener Umstellung blockiert ein Pending-Marker den normalen Start. Wiederholung des Umstellungsbefehls prüft Backup-Hash und Datenbestand, bevor sie den Marker entfernt. Kein automatisches destruktives Restore.
- `test:replica` enthält isolierte Docker-Tests für Transaktionen, wiederholtes Bootstrap, falsche Topologie, Standalone-Umstellung mit manuellen Daten, Restore-Probe, Neustart und unterbrochene/abweichende Verifikation. Es ist Bestandteil von `quality:full`.

## Abnahme dieses Abschnitts

Auf dem Rechner mit funktionierendem Docker, im Root dieses Branches:

```powershell
npm run test:replica
npm run quality:full
```

Beide Befehle verwenden für Datenbanktests eigene Container und Datenbanken. Kein Test soll die lokale Entwicklungsdatenbank umstellen oder zurücksetzen.

Erst nach erfolgreicher Docker-Prüfung das bestehende lokale Entwicklungsvolume umstellen:

1. Laufenden Dev-Stack mit `Ctrl+C` beenden und weitere DB-Writer schließen. Docker Desktop weiterlaufen lassen.
2. Im Repository-Root ausführen (bei anderem `DEV_DB_NAME` den Bestätigungsnamen anpassen):

   ```powershell
   npm run db:replica:init -- --writers-stopped=tobu_finance_dev
   npm run dev
   ```

3. Vorher manuell erstellte Daten prüfen, `Ctrl+C`, `npm run dev:down`, erneut `npm run dev`; Daten müssen erhalten bleiben.

Der Umstellungsbefehl bleibt auf die bekannte lokale Community-Konfiguration beschränkt: unbekannte Images, zusätzliche Anwendungsdatenbanken, Authentifizierung, Views, Time-Series und verschlüsselte Collections werden nicht automatisch übernommen. Externe Datenbanken werden nicht verändert. Ein bestehendes Volume ohne zugehörigen Compose-Container wird sicherheitshalber abgelehnt; dessen Zuordnung muss geprüft werden. Reguläres `dev:down` behält den Container und unterstützt den automatischen Neustart. `docker compose down -v` bleibt destruktiv und ist kein Umstellungs- oder Reparaturbefehl.

Ein Pending-Marker ist kein Schutz gegen direkte Fremdzugriffe. Die Bestätigung bedeutet, dass auch andere Clients/Jobs gestoppt wurden. Bei Fehlern Writer gestoppt lassen und Backup/Volume erhalten. Bei abweichenden Daten den Marker nicht manuell löschen. Dieser Abschnitt implementiert noch keinen allgemeinen Restore-Befehl.

## Bisherige Prüfungen

- API-Build und sechs API-Unit-Tests erfolgreich, einschließlich Vergleich des Snapshots mit dem bislang akzeptierten Modellstand.
- Sechs Tooling-Tests erfolgreich, einschließlich unveränderter externer SRV-/TLS-URI und der bestehenden Start-/Portschutztests.
- Workspace-, Quellschutz-, ESLint- und Formatprüfung erfolgreich.
- Zusätzlicher isolierter Smoke-Test mit lokal vorhandenem MongoDB 8.2: Replica-Set-Initialisierung, Wiederholung, Ablehnung fremder Topologie, Baseline und echter Transaktionsabbruch erfolgreich. Eigenes temporäres Datenverzeichnis und eigener Port, keine Änderung an einer bestehenden MongoDB-Installation oder Entwicklungsdatenbank.
- Docker-Tests gestartet, beide wegen nicht erreichbarer Docker-Engine fehlgeschlagen. Der Smoke-Test ersetzt ausdrücklich nicht die Docker-9.0.4-Abnahme. Kein neuer vollständiger Quality-Nachweis vorhanden.

## Abschnitt 2: transaktionaler Runner

Abschnitt 1 wurde vom Nutzer nach der E2E-Zeitbudgetkorrektur mit `ARTIFACT VERIFICATION PASSED` und `GATE 5 AUTOMATED VERIFICATION PASSED` abgenommen. Für diesen gemeldeten Lauf liegt hier kein neuer vollständiger quality.json-Bericht mit Commit-Zuordnung vor.

Implementiert in Abschnitt 2:

- Aktives Umzug mit einer Transaktion pro Up/Down, gemeinsamem Session-Storage und atomarem Schema-/Historienstand. Keine fachliche Beispielmigration wird auf Entwicklungsdaten ausgeführt.
- Begrenzter, automatisch Session-gebundener CRUD-Kontext; keine DDL, keine fremden/reservierten Namespaces, keine parallelen Aufrufe. Treiber-Retries behalten ihre Fehlerlabels trotz Umzug-Wrapper.
- Lesender Zielplan mit Hash-Bestätigung; explizit gestoppte Writer; exklusive persistente Sperre. Auch bei Fehler oder unklarem Commit bleibt Wartung aktiv. Recovery gleicht den Stand ab und verhindert durch einen Schreibkonflikt auf der Sperre nachträgliche alte Commits.
- App-Start und Readiness prüfen ausstehende Migrationen und Sperren. Laufende API einschließlich Auth lehnt neue Anfragen während Wartung ab. Dies ersetzt nicht das Stoppen und Drainieren sämtlicher Writer vor Migrationen.
- Generator, unveränderliche Quell-Prüfsummen, kontrollierter Katalog und Prüfung im Build. Down behält historische Prüfsummen. Neue Baselines bekommen eine Datenbank-ID; bekannte alte Baselines werden bei der ersten echten Migration atomar ergänzt.
- Separate kompilierte CLI für produktive Deployment-Konfiguration. Der Produktionsartefakttest prüft jetzt auch Plan und bestätigten No-op ohne TS-Runner.

Die [Agent-/Bedienanleitung](migration-authoring.md) enthält die konkreten Befehle. Die vollständige Abnahme dieses Abschnitts ist noch offen. Lokale Nachweise: API-Build, API-Units, Tooling inklusive Generator sowie echte API-/Datenbanktests auf einer isolierten MongoDB-8.2-Instanz. Die Commit-Antwortverluste werden am Treiber nach einem echten Server-Commit injiziert; der Prozessabbruch beendet einen separaten Runner tatsächlich. Der native Testserver verwendet zur schnellen Abbruchprüfung eine Transaktionslebensdauer von fünf Sekunden; Docker verwendet seinen Standard. Diese Tests ersetzen keinen Lauf auf MongoDB 9.0.4.

Auf dem Docker-Testrechner im Repository-Root dieses Branches:

Abschließende lokale Prüfung Abschnitt 2: 13 API-Unit-/Tooling-Tests und 27 API-/Datenbank-Integrationstests erfolgreich; dazu API-Build, Workspace-/Quellschutz, Vertragsinventar, ESLint und Formatprüfung. Docker bleibt hier nicht erreichbar, daher sind das erneute Docker-Gate, Browserabläufe und die saubere Produktionsinstallation mit den neuen Änderungen noch nicht bestätigt. Die ursprünglichen Import-Prüfsummen wurden nicht neu geschrieben; lediglich der absichtlich um die Manifestprüfung erweiterte API-Build ist in der bestehenden Liste angepasster Dateien dokumentiert.

```powershell
npm run test:integration
npm run quality:full
```

Danach auf weitere Nutzeranweisung warten. Noch offen: kontrollierte strukturelle Migrationen, allgemeines Backup/Restore-Journal, versionierte strukturelle Schema-Verifikation und abschließende Betriebsabnahme. Der allgemeine Runner stellt derzeit ausschließlich transaktionale Datenänderungen bereit; strukturelle Definitionen werden vor Änderungen abgelehnt.

## Historischer Nachtrag zu Abschnitt 1

Nachtrag 24.10.2026: Der Nutzer bestätigt beide Docker-Tests aus `test:replica` als erfolgreich. `quality:full` scheiterte anschließend beim Lifecycle-Test: Dessen separat zusammengesetzte URI enthielt noch keine direkte Host-Verbindung und folgte der Replica-Set-Adresse `mongo:27017`, die außerhalb des Docker-Netzes nicht auflösbar ist. Der Test verwendet jetzt denselben Konfigurationsloader mit seiner isolierten Prozessumgebung wie der Workspace. Die Tooling-Prüfung deckt die übergebene Umgebung, den abweichenden Port und die lokalen Replica-Set-Optionen ab. Lifecycle und vollständiges Gate müssen mit dieser Korrektur erneut ausgeführt werden; keine Datenbank-Neuinitialisierung nötig.

Die bestehende Freigabe alter Quality-Gates gilt nicht automatisch für Abschnitt 2. Kein Push oder Merge vorgenommen.

## Abschnitt 3: kontrollierte strukturelle Migrationen

Abschnitt 2 wurde vom Nutzer mit erfolgreichen Integrationstests und `GATE 5 AUTOMATED VERIFICATION PASSED` bestätigt. Ein vorheriger E2E-Lauf mit 54 Verbindungsfehlern auf localhost ist damit nicht ursächlich aufgeklärt. Der anschließend gemeldete Diagnoselauf bestand alle 54 Tests mit sechs Workern. Keine Änderungen an Workerzahl, Videos oder Retry-Verhalten in Abschnitt 3.

Implementiert: strukturelle Templates, versionierte Schema-Verifikation, ein struktureller Lauf pro bestätigtem Plan, eingeschränkter DDL-/Datenkontext, persistente Schritte und Wartungssperre, atomare abschließende Buchführung, explizites Resume/Restore. Echte Database-Tools-Archive werden durch vollständige Restore-Proben und BSON-/Metadatenvergleich geprüft. Wiederherstellung behält ihre operativen Journale und bleibt nach erneutem Abbruch fortsetzbar. Bestätigte historische Erfolge dürfen nicht per Backup zurückgesetzt werden. Lokaler Docker-Helper und native externe Werkzeuge sind getrennt; MongoDB bleibt auf 9.0.4 gepinnt. Details und Grenzen: [Strukturelle Migrationen](structural-migrations.md).

Lokale Nachweise: API-Build; 13 API-Unit-/Tooling-Tests; 35 Integrationsprüfungen auf einer ausdrücklich isolierten nativen MongoDB-8.2-Testinstanz. Letztere prüfen reale Datenbank-/Transaktionszustände; der strukturelle Memory-Backup-Adapter ist nur ein Testdouble zur kontrollierten Fehlererzeugung. Der zusätzliche Docker-Test prüft echte Archive, BSON-Sondertypen, Validatoren, beschädigte Backups, Restore, Prozesskill nach Rename, Resume und Down. Seine Ausführung auf MongoDB 9.0.4 steht noch aus; kein Ersatz durch die native Testinstanz.

Ergänzende Abschlussprüfung: neun strukturelle Prüfungen nach der Absicherung der DDL-Kommentare und TTL-Vorprüfung erfolgreich. Die tatsächlichen MongoDB-Kommandos tragen die Run-ID, damit Recovery laufende Strukturarbeiten erkennen kann. Der neue Docker-Test wurde hier gestartet und wegen nicht erreichbarer Docker-Engine abgebrochen, nicht übersprungen. Die Benutzeranleitung dokumentiert native Tools, Backup-Schutz, produktive Bestätigungen und die Grenzen bei Atlas/TTL.

API-Build, ESLint, Formatprüfung, Vertragsinventar/OpenAPI und Workspace-/Quellschutz sind erfolgreich. Externe Multi-Host-URIs werden vom Konfigurationsloader unverändert unterstützt; ein Tooling-Test sichert das ab. Keine neuen Paketabhängigkeiten, keine fachliche Migration, kein Push oder Merge.

Abnahme im Repository-Root auf dem Docker-Rechner:

```powershell
npm run test:replica
npm run test:integration
npm run quality:full
```

Die Tests verwenden eigene Datenbanken und Backup-Verzeichnisse. Keine manuelle Entwicklungsdatenbank migrieren oder zurücksetzen. Bei Fehlern die Ausgabe mitteilen; das Gate nicht durch Wiederholungen als ursächlich behoben ansehen. Danach auf weitere Anweisung warten. Abschnitt 4 (abschließende Betriebs-/Artefakt-/CI-Abnahme) ist noch nicht freigegeben.

## Abschnitt 4: Abschluss und Agent-Handover

Nachfolgende Review-Korrekturen, Entscheidungen und erneute Testnachweise sind in [Review-Nacharbeit](review-followup.md) dokumentiert. Die ursprüngliche Abnahme unten bleibt historisch erhalten.

Am 25.10.2026 meldet der Nutzer alle angeforderten Tests (`test:replica`, `test:integration`, `quality:full`) als erfolgreich und gibt Abschnitt 4 frei. Die Rückmeldung folgt auf Übergabe von `7d1d1d0`; ein vollständiger neuer Bericht mit Commit-Zuordnung liegt hier nicht vor. Die Docker-/Gesamtabnahme von Abschnitt 3 gilt damit als vom Nutzer bestätigt, nicht als auf dem Agent-Rechner neu ausgeführt.

Der [Abschluss-Handover](migration-handover.md) bündelt den Einstieg für Agents, reale Betriebsbefehle, Artefaktgrenzen, Recovery-Regeln, Nachweise und die separate GitHub-Einweisung. README, Entwickler-, Artefakt- und Copilot-Anleitung verweisen auf diesen Stand. Veraltete Aussagen über noch nicht implementierte Runner sind in den aktuellen Betriebsanleitungen korrigiert; die Architektur und frühere Nachträge bleiben als historischer Verlauf erhalten.

Prüfung der vorhandenen Abläufe: Der API-Build prüft das unveränderliche Migrationsmanifest und kompiliert die aktiven Module. Die Release-Paketierung kopiert gebaute Module und explizit ausgewählte Runtime-Dateien; Backups, Secrets, Tests und Legacy-Archiv gehören nicht dazu. Der Artefakttest installiert nur Produktionsabhängigkeiten und prüft die kompilierte CLI mit Plan und bestätigtem No-op. Es gibt derzeit keine fachliche Katalogmigration. Der Linux-CI-Job führt das vollständige Gate einschließlich echter Backup-/Replica-Set-Tests aus; Windows-CI ergänzt die Prüfungen ohne Docker.

Abschnitt 4 verändert ausschließlich Dokumentation, keine Laufzeitlogik, Abhängigkeiten, Testbudgets oder CI-Prüfungen. Deshalb werden die bereits vom Nutzer bestätigten Laufzeittests nicht ohne neue technische Änderung wiederholt. Lokale Abschlusskontrolle: relative Dokumentlinks, Konsistenz der referenzierten Befehle/Workflow-Schritte und Whitespace-Prüfung. Noch offen bleibt der tatsächliche GitHub-Lauf für den Abschluss-Commit. Kein Push, Merge, Deployment oder Datenbankumbau durch diesen Abschnitt. Produktive Betriebsfreigabe und bestehende Fach-/Sicherheitsaufgaben bleiben separat.
