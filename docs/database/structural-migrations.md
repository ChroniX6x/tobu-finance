# Kontrollierte strukturelle Migrationen

Stand: Abschnitt 3, 24.10.2026. Implementiert; Docker-/Gesamtabnahme steht noch aus. Die [Architektur](migration-architecture.md) und [Agent-Anleitung](migration-authoring.md) gelten weiter. Der transaktionale Modus bleibt der Standard für kleine Datenänderungen.

## Ablauf und Garantien

Ein struktureller Lauf verarbeitet genau eine Migration. Ein Up-Plan endet vor der nächsten strukturellen Migration oder enthält ausschließlich diese. Danach neu planen. Auf einer durch diesen Setup-Aufruf neu angelegten Datenbank arbeitet Setup die Pläne bis zum aktuellen Stand ab; vorhandene Datenbanken werden nicht automatisch migriert.

1. Zielplan bestätigen, sämtliche Writer stoppen und laufende Schreibvorgänge abschließen lassen. Der Runner prüft Topologie, Historie und Berechtigungen zur Prüfung laufender Serveroperationen.
2. Sperre und Journal gemeinsam transaktional anlegen. Phasen: `preparing`, `backup-verified`, `applying`, `verifying`, `succeeded`; für Wiederherstellung `restoring`, `restored`. Eine vorhandene Sperre bedeutet Wartung/Recovery, auch wenn kein separater Fehlerstatus gespeichert werden konnte.
3. Schema und fachliche Vorbedingungen prüfen. MongoDB Database Tools sichern die gesamte Anwendungsdatenbank einschließlich Baseline und Migrationshistorie. Operative Sperren, Journale und Restore-Besitzmarker sind ausgenommen.
4. Archiv in eine eigene, durch Run-ID und Besitzmarker geschützte Testdatenbank auf demselben Server zurückspielen. Dokumente werden BSON-typgetreu mit IDs, Counts und Inhaltsprüfsummen verglichen, außerdem Collection-Optionen, Validatoren und Indizes. Der Quellbestand wird davor und danach auf Veränderungen geprüft. Erst nach bestandener Probe wird das Backup als verifiziert markiert.
5. Jeden benannten Schritt prüfen, vor dem Schreiben als `started` speichern, ausführen und verifizieren, dann als `done` speichern. `inspect` entscheidet zwischen `before`, `after`, `ambiguous`. `after` überspringt die Schreiboperation; unklare Zustände brechen ab.
6. Gesamtschema und fachliche Nachbedingungen verifizieren. Umzug-Historie, Schema-Stand und Erfolgsstatus gemeinsam in einer kurzen Transaktion bestätigen. Erst anschließend die Wartungssperre freigeben.

Strukturänderungen und Restore sind **nicht atomar**. Bei Fehler bleibt die Anwendung gesperrt. Ein unbekanntes Commit-Ergebnis wird anhand des dauerhaften Journals abgeglichen; niemals auf Verdacht Down ausführen. Auch ein bestätigter struktureller Up wird nicht durch Wiederherstellen eines alten Backups zurückgenommen: dafür ist ein neuer Down-Plan mit neuer Sicherung erforderlich.

## Migration erstellen

```powershell
npm run db:migration:create -- beschreibender-name --type=structural
```

- Alle Platzhalter implementieren; sie werfen absichtlich Fehler. `preUp`, `preDown`, `verifyUp`, `verifyDown` sind ausschließlich lesend.
- `namespaces` nennt sämtliche betroffenen Quell-, Ziel- und Zwischen-Collections. Reservierte System-/Migrationscollections sind nicht zugänglich.
- `schemaChanges` beschreibt die vollständigen Zieldefinitionen geänderter Collections: `{ name, validator, indexes }`; `null` bedeutet, dass die Collection nach Up fehlen muss. Der Versionsstand entsteht aus unveränderlicher Baseline plus den Änderungen aller angewendeten strukturellen Migrationen. Indexdefinitionen müssen zur Serverdarstellung passen; nicht deklarierte zusätzliche Indizes auf geänderten Collections werden abgelehnt. Die vollständige Verifikation des Down-Ziels gehört zusätzlich in `verifyDown`, insbesondere das Entfernen neu angelegter Collections.
- Neue Indizes benötigen ausdrücklich angegebene, stabile Namen. Der Kontext sendet DDL-Kommandos einschließlich Run-ID direkt an MongoDB; manche Treiber-Hilfsmethoden würden den für Recovery benötigten Kommentar nicht weiterreichen.
- `up` und `down` enthalten benannte Schritte mit `inspect`, `apply`, `verify`. Alle Kontextaufrufe einzeln `await`en. `inspect` und `verify` dürfen nicht schreiben. Der Kontext bietet begrenzte Reads, Counts, Inserts/Updates, Collection-Anlage, Validator-, Index-, Drop- und Rename-Operationen. Keine Rohverbindungen, Sessions, Imports veränderlicher Runtime-Helfer oder externen Nebenwirkungen.
- Eine Operation kann trotz verlorener Antwort erfolgreich gewesen sein. `inspect` muss den tatsächlichen Zustand prüfen, einschließlich exakter Index-/Validatordefinitionen und fachlicher Dateninvarianten. Bloße Namensprüfung reicht in einer echten Migration nicht.
- Nachbedingungen früherer Schritte müssen auch nach späteren Schritten noch überprüfbar sein. Wenn das nicht möglich ist, die Inspektion entsprechend gestalten oder bei Teilständen ausdrücklich `ambiguous` melden und Restore verlangen.
- Für große Umstrukturierungen begrenzte, deterministische Batches und Shadow-Collections verwenden. Fortschritt muss aus den Daten eindeutig rekonstruierbar sein. Es gibt keinen allgemeinen atomaren Batch-Checkpoint oder automatischen Online-Umbau. Bei einem nicht eindeutig fortsetzbaren Batch Restore verwenden.
- Down muss zwischenzeitlich neu angelegte/bearbeitete Daten berücksichtigen. Informationsverlust nicht mit Default-Werten kaschieren. Unmögliche Rücknahme ausdrücklich ablehnen und einen geprüften alternativen Übergang vorlegen.
- Formatieren, `npm run db:migration:manifest`, Migration und Manifest gemeinsam reviewen. Bereits ausgeführte Dateien bleiben auch nach Down unveränderlich.

## Backup-Voraussetzungen

Lokal bei `DB_MODE=docker` verwendet die administrative CLI einen kurzlebigen Helper aus `mongo:9.0.4`. Er teilt den Netzwerk-Namespace des eindeutig anhand des veröffentlichten Loopback-Ports identifizierten MongoDB-Containers. Das funktioniert ohne öffentliche DB-Bindung und ohne fest codierten Compose-Namen. Daten und Logik hängen nicht von Docker ab.

Bei `DB_MODE=external` bzw. in Produktion werden `mongodump` und `mongorestore` im PATH benötigt. Multi-Host-, SRV-, Authentifizierungs- und TLS-Verbindungen bleiben erhalten; lediglich `appName` wird für die Diagnose gesetzt. Backup-Pfad: lokal `backups/migrations/<run-id>`, abweichend über absolutes `TOBU_MIGRATION_BACKUP_DIR`. Die produktive kompilierte CLI benötigt diese Variable ausdrücklich und verwendet `TOBU_MIGRATION_BACKUP_MODE=native`.

Das Verzeichnis enthält BSON-Archiv, Besitzerdatei und verifiziertes Manifest. Es muss außerhalb des DB-Volumes liegen, genug Platz für Archiv und Restore-Probe haben und gegen fremde Schreibzugriffe geschützt sein. Die Probe benötigt zusätzlichen Datenbankplatz auf demselben Deployment. Das ist eine Funktionsprüfung der Wiederherstellbarkeit, keine zweite unabhängige Ausfallsicherung.

URI/Passwort werden per kurzlebiger Tools-Konfigurationsdatei statt über Kommandozeilenargumente übergeben. Dateimodi werden gesetzt; unter Windows müssen passende NTFS-Rechte separat gewährleistet sein. Nach Prozesskill können Konfigurationsdateien zurückbleiben: erst nach bestätigtem Ende aller Tools-Prozesse aus dem zugehörigen Run-Verzeichnis entfernen. Archive enthalten Finanz- und Authentifizierungsdaten. Produktion verlangt geschützten/verschlüsselten Speicher, Aufbewahrung und eine zusätzliche unabhängige Sicherung. SHA-256 schützt vor versehentlicher Beschädigung, nicht vor einem Angreifer mit Schreibzugriff auf Archiv und Manifest.

Benötigte Rechte: Daten/Metadaten lesen und ändern, DDL, Transaktionen, Restore-Testdatenbanken anlegen/löschen, Database Tools, Search-Index-Abfrage und `$currentOp` mit `allUsers`. Fehlende Rechte führen zum Abbruch; nicht durch weitreichende Standard-Adminrechte im Anwendungskonto umgehen. Ein eigenes Wartungskonto verwenden.

**TTL ist ein Writer:** Bei befüllten Collections mit TTL-Index verlangt dieser Backup-Modus `ttlMonitorEnabled=false`. Diese globale Servereinstellung wird niemals automatisch verändert. In einem selbst verwalteten Deployment muss ein verantwortlicher Operator sie für das Wartungsfenster kontrolliert pausieren, laufende TTL-Arbeiten abwarten und nach Abschluss wieder aktivieren. Ohne Berechtigung oder auf einem geteilten/verwalteten Deployment ist gegebenenfalls ein anderes Backup-Verfahren erforderlich. Leere TTL-Collections der frischen Baseline sind zulässig. Andere Hintergrundschreiber, Trigger und Jobs ebenfalls stoppen.

Aktuelle Grenzen: reguläre Collections auf einem Replica Set; keine Sharding-Metadaten, Views, Time-Series, capped/verschlüsselten Collections, `system.*` oder Search-Indizes. Benutzer/Rollen, Serverkonfiguration und fremde Datenbanken werden nicht gesichert. Restore erfordert dieselbe Serverversion wie die Sicherung. Die tatsächliche Tools-/Serverkombination muss mit dem Restore-Test funktionieren; ein Server-/Tools-Upgrade gehört in eine eigene geprüfte Änderung. Atlas ist kein pauschal zugesagtes Backup-Ziel: Rechte, TTL, Search und Topologie können einen späteren Snapshot-/Backup-Adapter verlangen. Die kleine `MigrationBackup`-Schnittstelle erlaubt einen solchen Adapter ohne Änderung der Migrationen.

## Ausführung und Wiederherstellung

Normales Up/Down verwendet die [Plan-/Bestätigungsbefehle](migration-authoring.md). Produktionsbefehle laufen direkt über `node apps/api/dist/src/database/migration-cli.js`; zusätzlich zu `--confirm` und `--writers-stopped` sind `--maintenance-approved=<db-name>` und `--backup-protection-confirmed=<db-name>` erforderlich. Diese Bestätigungen ersetzen keine technische Verschlüsselung oder Wartungsorganisation.

Nach Fehler oder Prozessabbruch:

1. Writer gestoppt lassen. Alten Runner **und alle zugehörigen mongodump/mongorestore- oder Helper-Prozesse** nachweislich beenden. Eine beendete CLI allein reicht nicht. Ein struktureller Schreibbefehl hat keine transaktionale Fencing-Garantie.
2. `npm run db:migrate:plan` ausführen. Ziel, Run-ID, Journalphase und Schrittstatus kontrollieren. Der Plan funktioniert auch während eines unterbrochenen Restore, wenn Schema-/Historiencollections fehlen.
3. Genau einen Weg wählen:

   ```powershell
   npm run db:migrate:recover -- --confirm=<frischer-hash> --runner-stopped=<run-id> --writers-stopped=tobu_finance_dev --recovery=resume
   ```

   oder:

   ```powershell
   npm run db:migrate:recover -- --confirm=<frischer-hash> --runner-stopped=<run-id> --writers-stopped=tobu_finance_dev --recovery=restore
   ```

4. Recovery prüft noch laufende, mit Run-ID markierte Serveroperationen und übernimmt die Sperre nur bei unverändertem Besitzer. `resume` prüft jeden Schritt erneut. `restore` prüft Identität, Archiv-Hash und einen erneuten vollständigen Restore-Probelauf **vor** dem Löschen von Quelldaten. Danach stellt es den ursprünglichen Anwendungsbestand inklusive Historie wieder her. Zusätzliche, nicht zum Backup oder zur Migration gehörende Namespaces blockieren den Restore. Operative Sperren/Journale bleiben erhalten.
5. Bei erneutem Restore-Abbruch bleibt `restoring` bestehen. Neu planen und `restore` erneut ausführen; `resume` ist dann gesperrt. Erst Inhalts-/Schema- und fachliche Vorzustandsprüfung erlauben die Freigabe.
6. Bei `preparing` gab es noch keine Migrationsschreiboperation; `restore` beendet diesen gescheiterten Vorbereitungsversuch ohne destruktiven Restore. Bei `succeeded` erlaubt nur `resume` den Statusabgleich und die ausstehende Freigabe. Keine historischen Backups über spätere Nutzerdaten spielen.

Es gibt bewusst keinen automatischen Restore, auch lokal nicht. Backups und Journale bleiben zur Diagnose erhalten. Nicht manuell Sperren oder Journale löschen und nach einem Fehler nicht einfach Setup/Seed/Dev starten. Ein erfolgreicher Restore setzt den Stand unmittelbar vor diesem Lauf zurück, nicht die Datenbank auf eine leere Baseline.

## Prüfpflicht

Jede neue Migration braucht Tests für Up/Down und fachliche Invarianten, Vorbedingungen, teilweise ausgeführte Schritte, eindeutige und mehrdeutige Wiederaufnahme, fehlgeschlagene Verifikation, Prozessabbruch sowie Restore. Summen und Referenzen unabhängig berechnen. Ein leerer Beispielbestand reicht nicht.

`test:integration` prüft den Runner auf echten isolierten Datenbanken; ein ausdrücklich auf Tests begrenzter Memory-Backup-Adapter injiziert kontrolliert Wiederherstellungsfehler. Er ist kein Produktions-Backup. `test:replica` ergänzt echte MongoDB-9.0.4-/Database-Tools-Archive, BSON-Typen und Metadaten, korrupte Archive, Restore und einen tatsächlich beendeten strukturellen Runner. `quality:full` enthält beide und die bestehenden Browser-/Lifecycle-/Artefaktprüfungen. Keine Tests überspringen, um ein Gate grün zu bekommen.
