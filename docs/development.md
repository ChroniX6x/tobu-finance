# Entwicklung ab Phase 3

Voraussetzungen: Node 24.13.1, npm 11.8.0, Docker mit Compose und laufender Linux-Engine. Windows/VS Code ist der primäre Prüfpfad; die Node-Skripte unterstützen auch Linux/macOS. Keine native MongoDB-Installation nötig. MongoDB ist für Entwicklung und Tests auf **mongo:9.0.4** festgelegt (auf Nutzerwunsch neueste veröffentlichte Version, geprüft am 21.10.2026 anhand der [offiziellen Image-Liste](https://github.com/docker-library/docs/blob/master/mongo/README.md)). Die Freigabe dieser Kombination erfolgt über Gate 3, nicht allein durch den Download.

## Erstes Setup

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
| npm run db:seed | Fehlende Demo-Dokumente ergänzen; bestehende Dokumente unverändert lassen |
| npm run db:migrate | Aktuellen Baseline-Stand prüfen; noch keine Migrationen nach der Baseline vorhanden |
| npm run db:reset -- --confirm=tobu_finance_dev | Bewusst ausschließlich die Docker-DB tobu_finance_dev löschen und neu aufbauen |

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
