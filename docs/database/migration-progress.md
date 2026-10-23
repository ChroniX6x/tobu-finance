# Sichere Migrationen: Umsetzungsstand

Stand: 23.10.2026. Architektur freigegeben. Branch: `feat/safe-database-migrations`.

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

## Nächste Abschnitte nach Abnahme/Anweisung

Nachtrag 24.10.2026: Der Nutzer bestätigt beide Docker-Tests aus `test:replica` als erfolgreich. `quality:full` scheiterte anschließend beim Lifecycle-Test: Dessen separat zusammengesetzte URI enthielt noch keine direkte Host-Verbindung und folgte der Replica-Set-Adresse `mongo:27017`, die außerhalb des Docker-Netzes nicht auflösbar ist. Der Test verwendet jetzt denselben Konfigurationsloader mit seiner isolierten Prozessumgebung wie der Workspace. Die Tooling-Prüfung deckt die übergebene Umgebung, den abweichenden Port und die lokalen Replica-Set-Optionen ab. Lifecycle und vollständiges Gate müssen mit dieser Korrektur erneut ausgeführt werden; keine Datenbank-Neuinitialisierung nötig.

2. Aktiver Umzug-Runner, atomare Historie, Metadaten, Zielschutz, Sperren, Up/Down und Generator.
3. Allgemeine strukturelle Migrationen mit Wartung, Backup, Journal, Resume und Restore.
4. Vollständige Agent-/Betriebsanleitung, Produktionsartefakt und Gesamtabnahme.

`db:migrate` bleibt bis Abschnitt 2 eine Baseline-Prüfung. Noch keine Zusage allgemeiner atomarer Migrationen oder produktiver Recovery. Die bestehende Freigabe alter Quality-Gates gilt nicht automatisch für diese Änderungen. Kein Push oder Merge vorgenommen.
