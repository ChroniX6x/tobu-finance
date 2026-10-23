# Architekturvorschlag: aktive Umzug-Migrationen

Stand: 23.10.2026. **Nur Planung, noch nicht zur Implementierung freigegeben.** Grundlage ist die Nutzerentscheidung: transaktionale Migrationen als Standard, kontrollierte strukturelle Migrationen als Ergänzung. Dieser Vorschlag ersetzt die zuvor offene Entweder-oder-Entscheidung. Bestehende Programme und Datenbanken sind nicht verändert.

## 1. Bestehender Stand und notwendige Korrekturen

- Umzug 3.8.2 ist bereits eine API-Abhängigkeit; der aktive Runner fehlt. `db:migrate` prüft derzeit nur die Baseline.
- Docker-Compose und temporäre Testcontainer starten Standalone-MongoDB 9.0.4. Transaktionen benötigen ein Replica Set oder einen Sharded Cluster.
- Externe Verbindungen über `DB_MODE=external` und `mongodb://` beziehungsweise `mongodb+srv://` bestehen bereits und bleiben erhalten.
- `baseline.ts` erzeugt Validatoren und Indizes aus den jeweils aktuellen Modellen. Diese Ableitung ist kein unveränderlicher historischer Ausgangspunkt und muss durch einen versionierten Baseline-Snapshot ersetzt werden.
- Das Legacy-Archiv bleibt unverändert und außerhalb der aktiven Migrationen. `AGENTS.md` und `migration-authoring.md` werden nach der Umsetzung auf tatsächliche Befehle und Garantien aktualisiert.

## 2. Komponenten: möglichst wenige neue Mechanismen

Bestehende Bibliotheken verwenden: Umzug für Reihenfolge und Up/Down, MongoDB-Node-Treiber für Transaktionen, MongoDB Database Tools für logische Backups. Kein eigener Datenbank-Dump-Serializer und keine neue Workflow-Plattform.

Geplante Aufteilung innerhalb `apps/api/src/database`:

| Bereich | Verantwortung |
| --- | --- |
| `baseline/` | Eingefrorener Stand 2026-10-v1: Collection-Optionen, Validatoren, Indizes und erforderliche Basisdaten |
| `migrations/` | Neue Migrationen ab dieser Baseline; keine Test-Fixtures oder Legacy-Dateien |
| `migration-runner.ts` | Umzug, Zielprüfung, Sperre, Dispatch nach Migrationstyp, Statusabgleich |
| `migration-storage.ts` | MongoDB-Historie; bei transaktionalen Migrationen dieselbe Session wie die Datenänderungen |
| `migration-backup.ts` | Ausführung geprüfter Backup-/Restore-Werkzeuge und Verifikation |
| `migration-cli.ts` | Status, Plan, Up, Down, Resume und Restore; auch aus gebautem JavaScript ausführbar |

Ein Generator unter `apps/api/scripts` erzeugt das passende Template. Keine neue Paketversion allein für diese Erweiterung einführen. Vollständige Entwicklungsbefehle bleiben im Root.

## 3. Lokales Replica Set und externe Datenbanken

- Derselbe MongoDB-Image-Pin und dasselbe persistente Volume bleiben erhalten. MongoDB startet lokal mit einem Replica-Set-Namen.
- Ein idempotenter Bootstrap initialisiert das Set nur, wenn noch keine Set-Konfiguration existiert. Er wartet anschließend auf einen schreibbaren Primary. Keine automatische Re-Konfiguration eines fremden Sets und kein Löschen des Volumes.
- Die Umstellung eines vorhandenen Standalone-Volumes erfolgt bei gestopptem Dev-Stack. Vorher Datenbestand sichern und nachher Baseline, Beispieldaten und manuelle Daten prüfen. MongoDB-Version/FCV nicht gleichzeitig ändern. Wiederholte Starts führen nicht zu einer erneuten Initialisierung.
- Der lokale Container erhält eine innerhalb seines Netzwerks stabile Member-Adresse. Der Hostzugriff über einen veröffentlichten, ggf. zufälligen Port nutzt nur für diese lokale Ein-Knoten-Topologie `directConnection=true`; das löst die sonst problematische Erkennung interner Docker-Adressen. Kein pauschales Anhängen dieses Parameters an externe URIs.
- Temporäre Integrationstestcontainer werden ebenfalls als isolierte Single-Node-Replica-Sets gestartet. Port- und Projektisolation bleiben bestehen.
- Bei externen Verbindungen wird die vorhandene URI einschließlich TLS, SRV und Replica-Set-Optionen respektiert. Der Runner initialisiert, stoppt oder rekonfiguriert diese Datenbanken nicht. Eine externe Standalone-Instanz wird mit einem klaren Hinweis abgelehnt, sobald eine transaktionale Migration nötig ist; kein stiller Ersatzmodus.
- Ein einzelnes Mitglied ermöglicht Transaktionen, bietet aber keine Hochverfügbarkeit. Mehrknotenbetrieb und Atlas nutzen später denselben Runner. Backup-/Wartungsfreigaben bleiben abhängig vom Deployment.

## 4. Gemeinsames Migrationsformat und Historie

Jede Datei enthält stabile ID, Typ (`transactional` oder `structural`), Beschreibung, Vorgänger, betroffene Namespaces, `up`, `down` und Prüfungen für Vor-/Nachbedingungen. Strukturelle Dateien enthalten zusätzlich benannte Schritte und deren Wiederaufnahme-/Wiederherstellungsregeln.

Eine generierte Manifestdatei hält Reihenfolge und Quell-Prüfsummen fest. Source-Lauf und kompiliertes Artefakt verwenden dieselben IDs und Prüfsummen; nicht einen TS-Dateihash mit einem JS-Dateihash vergleichen. Änderungen oder fehlende Dateien zu bereits ausgeführten Migrationen führen zum Abbruch. Der Generator verwendet kollisionsfreie Zeitkennung plus Slug und exklusives Anlegen.

Reservierte Collections:

- `_tobu_schema`: Baseline- und kompatibler Schema-Stand; vorhandenen bekannten Marker kontrolliert übernehmen, unbekannte Marker ablehnen.
- `_tobu_migrations`: dauerhaft bestätigte Migrationen einschließlich Prüfsumme; von Umzug gelesen/geschrieben.
- `_tobu_migration_control`: exklusive Ausführung und Wartungszustand.
- `_tobu_migration_runs`: diagnostischer Verlauf, Backup-Referenz, Richtung, Schritte und Recovery-Status struktureller Läufe.

Control-/Run-Collections sind für Migrationscode und automatisches Restore tabu. Ein ergänzendes Manifest außerhalb der Zieldatenbank hält Backup-Prüfsumme, Ausgangszustand und Run-ID fest. Logs enthalten keine Tokens, Passwörter oder Finanzdatensätze.

Umzug orchestriert, liefert aber selbst keine Atomizität. Dafür ist ein kleiner eigener Storage-Adapter nötig; der unveränderte MongoDBStorage allein koppelt seine Buchführung nicht an die Transaktion.

## 5. Zielschutz, Wartung und Parallelität

- Vor jedem Schreibkommando Zielplan ausgeben: Umgebung, bereinigte Serveradresse, expliziter Datenbankname, Datenbank-ID, Ausgangsstand, Richtung und betroffene Migrationen. Keine Zugangsdaten ausgeben.
- Persistente Datenbank-ID beim kontrollierten Baseline-/Metadaten-Übergang vergeben. Bestätigung an Umgebung, Adresse, Datenbank-ID, Stand und Plan binden. Eine Datenbank-ID allein reicht nicht, weil sie mit einem Backup geklont werden kann.
- Systemdatenbanken, fehlende DB-Namen, unerkannte Baselines und widersprüchliche Historie ablehnen. Ein `--force` darf diese Prüfungen nicht aushebeln.
- Erster Ausbau: Migrationen im Wartungsablauf statt automatisch beim App-Start. In Entwicklung `db:migrate` bewusst ausführen; neue leere Datenbanken können im expliziten Setup Baseline und ausstehende Up-Migrationen durchlaufen. `dev` prüft nur und verweist bei ausstehenden Änderungen auf den Migrationsbefehl.
- Exklusive Sperre in MongoDB mit Run-ID. Kein zweiter Runner; bei verlorener Verbindung keine weiteren Schritte starten. **Keine automatische Übernahme einer abgelaufenen Sperre**, weil der alte Prozess möglicherweise noch arbeitet. Recovery verlangt den bestätigten Stillstand des früheren Runners.
- Vor strukturellen Änderungen sämtliche schreibenden APIs, Jobs und externen Clients stoppen/drainieren. Bereits laufende Requests müssen abgeschlossen sein, bevor das Backup beginnt. Wartungsmarker und Readiness verhindern neue reguläre App-Starts; ein Marker allein sperrt keine direkten Datenbankclients. Produktiv gehören Zugriffsbeschränkungen und die Stilllegung aller Writer zum Wartungsplan.
- Für die erste Version auch transaktionale Migrationen bevorzugt im selben exklusiven Wartungsablauf ausführen. Online-Migrationen bleiben eine spätere, migrationsspezifisch geprüfte Erweiterung.

## 6. Transaktionale Ausführung

1. Ziel, Historie, Topologie und Vorbedingungen prüfen; benötigte Metadaten-Collections kontrolliert vorbereiten.
2. Pro Migration genau eine MongoDB-Transaktion. Alle Datenoperationen, transaktional prüfbare Nachbedingungen, Schema-Versionsänderung und Umzug-Historieneintrag verwenden dieselbe Session.
3. Erst nach erfolgreicher Verifikation committen. Standard: Primary, Snapshot-Lesesicht und Majority-Schreibbestätigung. Keine DDL als versteckte Nebenwirkung; der transaktionale Kontext stellt nur die unterstützten Datenoperationen bereit und bindet die Session automatisch.
4. Bei Fehler vor Commit Transaktion abbrechen. Bei Prozessabbruch vor Commit verwirft MongoDB die unbestätigten Änderungen, gegebenenfalls nach Ablauf der Transaktion. Kein kompensierendes Down auf einen unbekannten Teilstand ausführen.
5. Treiber-Mechanismen für wiederholbare Transaktionsfehler und unklare Commit-Antworten verwenden. Callback ohne externe Nebenwirkungen, keine parallelen Session-Operationen, deterministische IDs. Retry-Limits und Timeouts begrenzen den Ablauf.
6. Bleibt das Commit-Ergebnis unbekannt: nicht als Rollback melden, Wartungszustand halten. Nach Wiederverbindung atomare Historie und Datenstand prüfen; erst dann Ergebnis bestimmen oder sichere Wiederaufnahme zulassen.

Die Garantie gilt **pro Migration**, nicht automatisch für einen gesamten Stapel: Scheitert Migration B, kann die zuvor erfolgreich abgeschlossene Migration A bestehen bleiben. Ein fachlich unteilbarer Datenübergang gehört in eine einzige passende Transaktion. Eine erfolgreiche Down-Migration ist ebenfalls atomar; scheitert sie, bleibt der vorherige Up-Stand erhalten.

Transaktionslimits dürfen nicht durch riesige Timeouts umgangen werden. Große Umstrukturierungen gehören in den strukturellen Modus mit verifizierten Schritten. Der Kontext ist eine Sicherheitsführung für vertrauenswürdigen Projektcode, keine Sandbox gegen bösartige Imports oder separate MongoDB-Verbindungen; Review und Regeln müssen solche Umgehungen verhindern.

## 7. Strukturelle Ausführung und Wiederherstellung

Zustände: `preparing → backup-verified → applying → verifying → succeeded`. Ein Fehler oder verlorener Runner während `applying/verifying` führt zu `recovery-required`; die Anwendung bleibt gesperrt. Eine ausgeführte Migration wird erst nach abschließender Verifikation als erfolgreich verbucht.

Die abschließende Buchführung (Historie, Schema-Stand und erfolgreicher Run-Status) erfolgt gemeinsam in einer kurzen Transaktion. Das macht die vorausgehenden Strukturänderungen nicht atomar. Bei unklarem Commit-Ergebnis bleibt die Wartung aktiv, bis der Status abgeglichen ist. Deshalb setzt auch dieser kontrollierte Modus ein transaktionsfähiges Deployment voraus.

### Vor der ersten Strukturänderung

- Wartung und Writer-Stillstand sicherstellen, Voraussetzungen, benötigte Rechte und Speicherplatz prüfen.
- Zunächst eine vollständige **logische Sicherung der Anwendungsdatenbank** mit MongoDB Database Tools. Dazu Collection-Optionen, Validatoren, Indizes und bestätigte Schema-/Migrationshistorie sichern. Operative Control-/Run-Collections aus dem wiederherzustellenden Bereich ausschließen.
- Sicherung außerhalb des MongoDB-Datenvolumes und außerhalb von Git/Release-Artefakten ablegen, mit Dateizugriffsrechten schützen; produktiv verschlüsselt und mit definierter Aufbewahrung. Tools-Version und Serverkompatibilität prüfen. Kein Kopieren eines laufenden WiredTiger-Verzeichnisses.
- Vor Anwendung in eine eigene Restore-Testdatenbank einspielen und prüfen: Namespace-Inventar, BSON-typgetreuer Inhaltsvergleich/Prüfsummen, Dokumentanzahl, Optionen, Validatoren, Indexdefinitionen sowie fachliche Summen/Referenzen. Reine Dateiprüfsumme oder Exitcode von mongodump reicht nicht.
- Die Restore-Testdatenbank darf weder Quell- noch Entwicklungsdatenbank sein und wird vor jedem destruktiven Befehl durch Name, Ziel und Besitzmarkierung geprüft. Nicht unterstützte Collection-Typen/Metadaten (z. B. Search-Indizes oder Sharding-Konfiguration) führen zur Ablehnung dieser Backup-Strategie.

### Ausführung

Jeder Schritt hat `inspect`, `apply` und `verify` sowie eine persistierte Kennung. Der Schritt wird vor Ausführung als gestartet markiert. Nach Abbruch zwischen tatsächlicher Operation und Statusschreiben muss `inspect` zwischen Ausgangs- und Zielzustand unterscheiden können. Unklare Zwischenstände werden nicht blind erneut ausgeführt.

Erlaubte Wiederaufnahme nur für ausdrücklich sichere Schritte: etwa ein Index mit exakt erwarteter Definition oder ein Batch mit atomar gespeichertem Fortschritt. Nicht eindeutig wiederaufnehmbare Änderungen gehen in den Restore-Weg. Für große Umbauten Shadow-Collections und überprüfte Batches bevorzugen; die abschließende Umschaltung mehrerer Collections ist trotzdem nicht pauschal atomar.

### Fehler und Recovery

- Default: stoppen und Wartung behalten. `recover --resume` nur mit erfolgreicher Zustandsprüfung; `recover --restore` stellt den gesicherten Ausgangsstand wieder her.
- Bei Restore Zielbestand explizit gegen das Backup-Inventar abgleichen. Von der Migration neu angelegte oder umbenannte Namespaces müssen berücksichtigt werden; einfaches mongorestore mit `--drop` beseitigt nicht automatisch alle zusätzlichen Collections.
- Nur den registrierten Anwendungsbereich zurücksetzen. Control-/Run-Metadaten, andere Datenbanken und fremde Namespaces nicht überschreiben. Während der Wiederherstellung keine Anwendungszugriffe erlauben.
- Restore ist selbst nicht atomar. Bei Abbruch bleibt `recovery-required` beziehungsweise `restoring` erhalten; die Anwendung bleibt gesperrt. Derselbe geprüfte Backup-Stand kann kontrolliert erneut vollständig eingespielt werden.
- Erst nach erfolgreicher Struktur-, Daten- und fachlicher Prüfung den Ausgangsstand als wiederhergestellt markieren und Wartung freigeben. Eine fehlgeschlagene Migration wird nicht als erfolgreich verbucht.
- Entwicklung: sicher erkannte Fehler dürfen aus einem zuvor verifizierten Backup automatisch wiederhergestellt werden, sofern Runner und DB erreichbar und alle Writer gestoppt sind. Nach Prozessabbruch erfolgt Recovery ausdrücklich beim nächsten Aufruf; `dev` stellt niemals stillschweigend Daten zurück.
- Produktion: kein automatisches destruktives Restore. Separater bestätigter Recovery-Plan, Wartungsfenster und ggf. Bedienerfreigabe. Ein erfolgreicher historischer Up darf nicht durch Rückspielen eines alten Backups spätere Nutzerdaten löschen; dafür ist ein geprüfter Down-Übergang oder ein eigener Wiederherstellungsplan nötig.

## 8. Betrieb ohne Docker-Bindung

Der Runner benötigt eine MongoDB-URI, keinen Container-Namen. Lokale Orchestrierung startet das Replica Set; externe Verbindungen bleiben fremdverwaltet. Backup-Werkzeuge können lokal oder in einem Hilfscontainer laufen, ohne dass Migrationen davon wissen müssen.

Zunächst implementieren: ruhende logische Datenbanksicherung mit echtem Restore-Test für die vorhandenen regulären Collections. Für spätere große/produktive Atlas- oder Clusterinstallationen eine kleine Backup-Schnittstelle vorsehen (`create`, `verifyRestore`, `restore`, `inspect`) statt Atlas-APIs jetzt schon zu implementieren. Ein nicht implementiertes oder für das Ziel ungeeignetes Backend führt zum Abbruch vor Strukturänderungen.

Atlas-Snapshots können später geeigneter sein, sind aber tarif-/topologieabhängig und teilweise clusterweit. Ein Restore darf keine fremden Datenbanken zurücksetzen. Zielcluster, RPO/RTO, Rechte, Geheimnisse, Anwendungskonfiguration und ein echter Restore-Probelauf müssen vor produktivem Einsatz festgelegt werden. Keine Behauptung, jede Atlas-Variante sei bereits abgedeckt.

Produktive Migrationen erhalten einen separaten kompilierten CLI-Einstieg mit ausdrücklicher Ziel-/Umgebungsbestätigung. Die bestehenden Dev-Befehle bleiben bei `NODE_ENV=production` gesperrt. Keine Zugangsdaten in Kommandozeilenargumenten, Logs oder Git.

## 9. Baseline, Up/Down und Agent-Anleitung

- Aktuelle Baseline einmalig als historischen Snapshot einfrieren und gegen den heutigen Stand testen. Bestehende valide Datenbanken ohne Datenänderungen anerkennen, neue Metadaten kontrolliert ergänzen. Nie unbekannte Datenbanken übernehmen.
- Neuinstallation: eingefrorene Baseline → alle erforderlichen Migrationen → optionaler Entwicklungsseed. Bestehende DB: nur ausstehende Migrationen, niemals Baseline oder Demo erneut schreiben.
- Schema-Verifikation gegen den **erwarteten jeweiligen Versionsstand**, nicht stets gegen das neueste Modell. Readiness verlangt einen mit der Anwendung kompatiblen Stand und keine offene Recovery.
- Generator bietet transaktionales und strukturelles Template. Unimplementierte Up/Down-/Verifikationsfunktionen brechen ausdrücklich ab, statt als No-op Erfolg zu melden.
- Down darf keine verlorenen Informationen erfinden. Falls verlustfreie Rücknahme unmöglich ist, muss die konkrete Migration mit nachvollziehbarer Alternative zur Freigabe vorgelegt werden; kein stiller automatischer Rückwärtslauf.
- `AGENTS.md` und die Migrationsanleitung erläutern reale Befehle, Sessionbindung, eingeschränkte APIs, immutable Dateien, Versionsmanifest, Backup-Prüfung, Resume/Restore und Testpflichten. Bestehende Copilot-Hinweise erhalten einen Verweis auf diese gemeinsame Quelle.

Vorgesehene Befehlsfamilie (noch nicht implementiert): `db:migration:create`, `db:migrate:status`, `db:migrate:plan`, `db:migrate`, `db:migrate:down`, `db:migrate:recover`. Schreibbefehle erhalten eindeutige Richtung und Zielbestätigung; Status und Plan bleiben lesend.

## 10. Umsetzung und Abnahmetests nach Freigabe

1. Baseline-Snapshot und kompatible Metadaten; bestehende Daten erhalten. Replica-Set-Bootstrap für Dev und Tests einschließlich Neustart/Volume-Umstellung.
2. Umzug-Runner, transaktionaler Storage, Zielschutz, exklusive Ausführung, Up/Down und Generator.
3. Struktureller Ablauf, Backup/Restore-Verifikation, Journal, Recovery und Wartungsgates.
4. Agent-/Benutzerdokumentation, Produktionsartefakt, vollständige lokale/CI-Abnahme. Kein Merge vor erfolgreichem neuen Gate.

Verpflichtende Tests:

- Bestehendes Standalone-Volume → Replica Set ohne Verlust manueller Daten; zweiter Start, zufällige Ports, externe Replica-Set-URI und SRV/TLS-Konfiguration ohne lokale Umschreibung.
- Transaktionaler Up/Down; erzwungener Fehler nach Writes; Fehler beim Historieneintrag; konkurrierender Runner; Prozesskill vor Commit; Verbindungsverlust und unbekannte Commit-Antwort. Daten und bestätigte Historie müssen zusammenpassen.
- Strukturelle Validator-/Index-/Rename-Migration sowie Batch-Umbau. Fehler und Prozesskill vor/nach jedem Schrittstatus, vor finaler Verifikation und während Restore. Kein App-Zugriff bei Recovery.
- Backup defekt/unvollständig, Restore falsches Ziel, Fremddatenbank, veränderte Migrationsdatei, unbekannte Historie und übernommene Sperre ablehnen. Keiner dieser Fälle darf still mit Schreiboperationen fortfahren.
- Frische Baseline plus Migrationen entspricht dem migrierten Vorgänger; Down behandelt inzwischen geänderte Daten korrekt oder lehnt sie ab.
- Datenvergleich prüft nicht nur Counts, sondern IDs, BSON-Typen, Beziehungen, Geldsummen, Validatoren und Indexdefinitionen.
- Kompilierte aktive Migrationen ohne TS-Runner; kein Legacy-Import; bestehende 54 Mock-E2E, Real-API-, Lifecycle-, Vertrags- und Artefaktprüfungen erhalten. Tests isoliert, keine Änderung der Entwicklungsdatenbank.

## 11. Grenzen und verworfene Alternativen

| Ansatz | Bewertung |
| --- | --- |
| Alle Operationen in MongoDB-Transaktionen erzwingen | Scheitert an nicht unterstützter DDL und großen Umbauten |
| Bei jedem Fehler einfach Down aufrufen | Unsicher bei Teilständen, erneutem Fehler oder Prozessabbruch |
| Docker-Image/Container zurücksetzen | Stellt persistente Daten nicht wieder her und bindet an Docker |
| Eigenes JSON-Backup aller Dokumente | Unnötig riskant bei BSON-Typen, Optionen und Indizes |
| Schatten-Datenbank und kompletter Verbindungswechsel | Interessant für sehr große Umbauten, aber zusätzlicher Betriebs-/Deploymentaufwand; nicht erste Implementierung |
| Ausschließlich Atlas-Snapshots | Für lokale/externe Installationen nicht ausreichend; späterer produktiver Adapter möglich |

Die erste Implementierung garantiert atomare unterstützte Datenmigrationen und einen kontrollierten, getesteten Recovery-Weg für die beschriebenen strukturellen Fälle. Sie garantiert weder sofortige automatische Rückkehr bei Hardware-/Backupverlust noch beliebige Online-DDL oder Hochverfügbarkeit des lokalen Ein-Knoten-Sets.

## Quellen

- [Umzug: Migrationen und eigenes Storage](https://github.com/sequelize/umzug)
- [MongoDB-Transaktionen: Deployment-Voraussetzungen](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/)
- [Eingeschränkte Transaktionsoperationen](https://www.mongodb.com/docs/manual/core/transactions-operations/)
- [Node-Treiber: Transaktionen, Session und Commit-Fehler](https://www.mongodb.com/docs/drivers/node/v6.x/crud/transactions/)
- [mongodump: Konsistenz bei laufenden Schreibzugriffen](https://www.mongodb.com/docs/database-tools/mongodump/)
- [Backup-Inhalte und Metadaten](https://www.mongodb.com/docs/database-tools/mongodump/mongodump-behavior/)
- [Atlas-Snapshot-Restore und Einschränkungen](https://www.mongodb.com/docs/atlas/backup/cloud-backup/restore-from-snapshot/)
