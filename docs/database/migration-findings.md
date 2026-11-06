# Offene Findings: Migrationsbetrieb

Bewerteter ursprünglicher Code-Stand: `30a9c7f` plus damalige Review-Korrekturen. Quelle: Nutzerreview, anschließend gegen den Code geprüft. Die folgenden Befundbeschreibungen bleiben als Abnahmekriterien erhalten. **E03-Wiederaufnahme:** S1/S2 implementiert und gezielt isoliert geprüft; aktueller vollständiger Gate-/Reviewstatus im [E03-Bericht](../agents/runs/E03.md). S3–S7 bleiben offen. Frühere Abnahmen schließen diese Punkte nicht automatisch.

| ID  | Schwere                              | Bewertung / Priorität                                                                                                                       |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | mittel                               | E03: Identität v2 implementiert; Rotation, Wartungskontowechsel, Rechte, Klone und Legacy-Ablehnung real geprüft. Gesamtstatus siehe E03.   |
| S2  | mittel                               | E03: feste Kategorien und Phase/Run, sichere Umzug-Wrapper, Getter-/Secret-Tests implementiert und gezielt geprüft. Gesamtstatus siehe E03. |
| S3  | niedrig bis mittel                   | Zustimmung. Verständliche Meldung bei konkurrierendem Lock-Erwerb ergänzen.                                                                 |
| S4  | niedrig                              | Zustimmung. Öffentliche Betriebsdetails reduzieren.                                                                                         |
| S5  | niedrig                              | Zustimmung. Begrenzte Tool-Laufzeit mit sicherem Prozess-/Container-Stopp entwerfen.                                                        |
| S6  | niedrig; Restore-Vorbedingung mittel | Teilweise Zustimmung. Komfort-Lockerung optional; erneute TTL-Prüfung vor Restore vor produktiven strukturellen Migrationen ergänzen.       |
| S7  | niedrig                              | Zustimmung. Containerrechte reduzieren; Digest-Pinning separat bewerten.                                                                    |

## S1 – Ziel- und Bestätigungshash enthalten die rohe URI

E03-Umsetzung: `migration-target.ts`, versionierte Locks/Journale und getrennte sichere Planbestätigung. Alte URI-gebundene Journale werden ausdrücklich ohne Mutation abgelehnt; der versionsgebundene Recoveryweg steht in [migration-authoring.md](migration-authoring.md#zielidentität-und-sichere-diagnostik-e03). Keine automatische Konvertierung alter Hashes oder Archive. Die nachfolgende Beschreibung dokumentiert den ursprünglichen Befund und die Prüfkriterien.

**Fundstelle:** `migration-runner.ts`, `confirmation()` und `targetHash()`; Verwendung in Journal, Backup-Besitzdatei und Manifest.

Der Hash bindet Credentials und flüchtige Verbindungsoptionen ein. Besonders der persistierte Zielhash kann bei Kenntnis der übrigen URI-Bestandteile als Offline-Prüfwert für schwache Passwörter dienen. Der Bestätigungshash enthält zusätzlich Plandetails; das ändert nichts daran, dass Credentials nicht als Teil eines veröffentlichten Zielprüfwerts verwendet werden sollten. Credential-Rotation oder ein anderes Wartungskonto ändern außerdem den Hash und blockieren die strukturelle Recovery bereits beim Journalabgleich.

**Geplante Richtung:** Credential-freie Zielidentität von der Bestätigung eines konkreten Plans trennen. Umgebung, Datenbankname/-ID und geprüfte Deployment-Identität erhalten; keine Passwörter oder Tokens hashen. Hostliste und Replica-Set kanonisch behandeln, Multi-Host/SRV und URL-Encoding berücksichtigen. Nicht blind sämtliche Query-Optionen verwerfen: Zielidentität, Transport-/Sicherheitseinstellungen und verbindliche Plandetails sind getrennt zu bewerten.

Der vorgeschlagene Regex ist eine Skizze, keine vollständige Lösung: Hostreihenfolge, DNS/SRV, Portwechsel, andere Zugangspfade und geklonte Datenbanken müssen berücksichtigt werden. Ein anderer Port kann dasselbe Deployment oder ein fremdes Ziel bedeuten; nicht automatisch gleichsetzen. Falls eine bestätigte Neuzuordnung nötig ist, muss sie den tatsächlichen DB-/Deployment-Stand prüfen. Keine pauschale Umgehung des Zielschutzes.

**Abnahme:** Passwortrotation/anderes Wartungskonto auf demselben bestätigten Ziel erlaubt Recovery; falsche DB, fremdes Deployment und ungeprüfter Klon bleiben gesperrt. Credentials tauchen weder direkt noch in einem daraus ableitbaren Prüfwert in neuen Plänen/Journaldaten auf. Übergang vorhandener URI-gebundener Journale und Backup-Manifeste ausdrücklich entwerfen und testen; alte Hashes nicht still umetikettieren oder Sperren löschen.

## S2 – Migrationscode-Fehler bleiben für Operatoren opak

E03-Umsetzung: `migration-errors.ts` und Phasen-/Run-Kontext in beiden Runnern; geschützte Umzug-Fehler mit erhaltenen bekannten Retrylabels. CLI und Setup verwenden dieselbe sichere Ausgabe. Nachfolgend ursprünglicher Befund und Prüfkriterien.

**Fundstelle:** `migration-errors.ts`, `MigrationRunner.run()` und `migration-cli.ts`.

Eigene `MigrationDiagnosticError`-Meldungen sind sichtbar. Assertions, normale Fehler aus `verifyUp`/`verifyDown` und Treiberfehler werden weiterhin unterdrückt; eine Run-ID allein reicht für die Diagnose oft nicht aus.

**Geplante Richtung:** Sichere Fehlerkategorie und bekannte Fehlercodes ausgeben, zusätzlich zur Run-ID und dem bekannten Ausführungsschritt. Keine rohe `message`, keinen Stack, kein Dokument und keine vollständigen Treiberursachen ausgeben. Auch `name`, `codeName` und stringförmige `code`-Werte sind beliebige Eingaben und können Geheimnisse enthalten. Den vorgeschlagenen `String(value)`-Ansatz daher nicht ungefiltert übernehmen: bekannte Kategorien/Codes abbilden, unbekannte Werte neutral darstellen, Ausgabe begrenzen.

**Abnahme:** Assertion, Dokumentvalidierung, Verbindungsfehler und unbekannter Fehler sind soweit sicher unterscheidbar. Tests mit Geheimnissen in `message`, `name`, `codeName`, `code`, `cause` und manipulierten Eigenschaften dürfen keine vertraulichen Werte ausgeben. Die Recovery-Pflicht bleibt bestehen.

## S3 – Lock-Race liefert eine irreführende Fehlermeldung

**Fundstelle:** `control.insertOne` in `MigrationRunner.run()` und die Lock-Anlage in `StructuralRunner.begin()`.

Zwei gültige Pläne können gleichzeitig zum Lock-Erwerb gelangen. Der Verlierer erhält einen Duplicate-Key-Fehler, den die CLI derzeit als allgemeines Verbindungs-/Berechtigungsproblem darstellt.

**Geplante Richtung:** Code 11000 ausschließlich beim Erwerb des bekannten Runner-Locks in eine sichere Meldung wie „Ein anderer Runner hat die Sperre zuerst erworben; erneut planen“ übersetzen. Nicht alle Duplicate-Key-Fehler einer strukturellen Transaktion oder fachlichen Migration pauschal so klassifizieren. Der Verlierer darf weder den fremden Lock entfernen noch eigene Recovery verlangen, wenn er keinen Lauf übernommen hat.

**Abnahme:** Zwei tatsächlich konkurrierende Runner, jeweils transaktional und strukturell: genau einer erwirbt den Lock; der andere erhält die zutreffende Meldung. Daten-/Historien-Duplicate-Keys bleiben fachliche Fehler und werden nicht als Konkurrenz umgedeutet.

## S4 – Öffentliche Health-Endpunkte veröffentlichen Migrations-IDs

**Fundstelle:** `server.ts`, `/ready` und `/health/migrations`; `schemaStatus()` liefert unter anderem `pending`.

Zeitstempel und Slugs können interne Funktions-/Schemaänderungen verraten. Das ist ein begrenztes Informationsleck, kein Zugriff auf Finanzdaten.

**Geplante Richtung:** Öffentliche Antworten auf ein festes, minimales `{ ready, status }` begrenzen. Granularität von `status` bewusst festlegen; IDs, Historie und interne Versionsdetails nur über administrative Diagnose zugänglich machen. Die CLI behält ausführliche Pläne.

**Abnahme:** Öffentliche Antworten bei bereit, ausstehenden Migrationen, Recovery und DB-Fehler enthalten keine IDs/Slugs/Versionshistorie. HTTP-Status und Readiness-Verhalten bleiben korrekt; die administrative Diagnose bleibt nutzbar.

## S5 – Database Tools haben keine Laufzeitgrenze

**Fundstelle:** `migration-backup.ts`, `execFile` für `mongodump`/`mongorestore` und Docker-Helper.

Ein hängender Prozess kann die CLI unbegrenzt blockieren. Die Sperre bleibt dabei konservativ erhalten; das ist hauptsächlich ein Betriebsproblem.

**Geplante Richtung:** Explizites, konfigurierbares Zeitbudget mit plausiblen Grenzen, sicherer Timeout-Meldung und kontrolliertem Stopp. Nicht einfach nur `execFile.timeout` hinzufügen: Das Beenden des Docker-Clients beendet nicht zuverlässig den gestarteten Helper; auch native Kind-/Serveroperationen sind zu berücksichtigen. Nur eigene Prozesse/Container stoppen, deren Ende prüfen und Recovery weiter ausdrücklich verlangen. Kein automatischer zweiter Dump/Restore und kein Entsperren nach Timeout.

**Abnahme:** Hängende native Tools und Docker-Helper werden gezielt beendet; fremde Prozesse bleiben unberührt. Ein unterbrochener Restore hält die Wartungssperre. Nach bestätigtem Ende aller zugehörigen Arbeiten funktioniert der dokumentierte Recovery-Weg. Große legitime Backups können ein ausdrücklich angepasstes Budget verwenden.

## S6 – TTL-Guard: Bedienbarkeit und erneute Prüfung vor Restore

**Fundstelle:** `ToolsBackup.prepare()` prüft `ttlMonitorEnabled` bei befüllten TTL-Collections; `restore()` prüft diese Voraussetzung nicht erneut. `auth_sessions` macht den Fall im regulären Betrieb häufig.

**S6a, optionaler Komfortpunkt:** Die bestehende Strenge ist konsistent und vertretbar. Ein Vorher-/Nachhervergleich erkennt beobachtete Löschungen, verhindert aber keine TTL-Schreibvorgänge während langer Abläufe. Ein Sicherheitsfenster funktioniert nur mit tragfähigen Laufzeitannahmen einschließlich Restore-Proben und Wiederholungen. Daher keine Lockerung nur aufgrund momentan nicht abgelaufener Sessions. Erst nach S5 und einer getesteten Konsistenzstrategie neu bewerten; globale TTL-Einstellungen nie still verändern.

**S6b, konkrete Härtung:** Bei späterer Recovery kann der Operator TTL inzwischen wieder aktiviert haben. Vor Restore-Probe und insbesondere vor destruktiven Schritten dieselbe notwendige Stillstandsbedingung anhand des zu restaurierenden Bestands prüfen. Das Backup-Inventar ist dabei wichtig: Nach Teil-Restore können im aktuellen Ziel Collections fehlen. Eine erforderliche Pause muss für das gesamte Wartungsfenster gelten; keine punktuelle Prüfung als Schutz vor beliebigen späteren Operatoränderungen ausgeben.

**Abnahme:** Backup bei pausierter TTL, erneutes Aktivieren, dann Restore: Abbruch vor destruktiven Zieländerungen bei befülltem TTL-Backup. Auch nach Teil-Restore mit fehlenden Zielcollections wird der Fall erkannt. Leere TTL-Collections bleiben zulässig. Strenger Default bleibt bis zu einer separat geprüften Alternative bestehen.

## S7 – Backup-Container weiter härten

**Fundstelle:** Docker-Aufruf in `ToolsBackup.tool()`.

**Geplante Richtung:** `--cap-drop=ALL` und `--security-opt=no-new-privileges` ergänzen und unter Linux sowie Docker Desktop prüfen. Explizite Host-UID/GID, privater Bind-Mount, direkter Tool-Entrypoint und geteiltes Ziel-Netzwerk bleiben erhalten. Optional Digest-Pinning bewerten: gemeinsame Image-Konfiguration, Compose-Konsistenzprüfung, Architekturunterstützung und Updateverfahren müssen gemeinsam angepasst werden.

**Abnahme:** Echter Dump, Restore-Probe, Wiederherstellung und Prozessabbruch-/Recovery-Test bestehen mit reduzierten Containerrechten. Keine Lockerung von Dateirechten oder Ausweitung des gemounteten Dateibaums. Digest-Pinning nicht isoliert gegen den vorhandenen Tag-Check einführen.

## Dokumentierte, akzeptierte Grenzen

Derzeit kein eigener neuer Umsetzungsauftrag für diese Punkte; bestehende Schutzmechanismen und Tests erhalten:

- Struktureller Lock ist kein Transaktions-Fence. Zwischen Besitzprüfung und Kommando bleibt ein Fenster; `$currentOp` ersetzt nicht den bestätigten Stillstand des alten Runners und seiner Tools.
- Request-Coalescing kann einen Read teilen, der kurz vor der Sperre begann. Writer vor Migrationen stoppen und drainieren; „nicht gesperrt“ nicht langfristig cachen.
- Die Prüfsumme bindet TS-Quelltext, nicht das emittierte JavaScript. Compiler-/Runtime-Upgrades separat reviewen und testen.
- AST-Prüfung führt vertrauenswürdigen Projektcode, ist keine Sandbox gegen `eval`, `process` oder eigene Nebenwirkungen.
- Überschreitet eine transaktionale Migration ihr Zeitbudget, bleibt bei Abbruch die Recovery-Sperre bestehen. Kein Erfolg oder sicherer Rollback bei unbekanntem Commit behaupten.

## Einordnung vor Merge und erstem Einsatz

S1/S2 sind seit der E03-Wiederaufnahme implementiert; konkrete Abnahme und verbleibende Betriebsgrenzen stehen im E03-Bericht. S3–S7 bleiben Nacharbeiten. Die Aussage „keine Blocker“ aus einem Review ist keine eigenständige Merge- oder Produktionsfreigabe. Vor Merge den tatsächlichen PR-CI-Erfolg für den neuesten Commit prüfen; hier liegt keine neue CI-Bestätigung vor.

Für den Einsatz gelten die dokumentierten S1/S2-Nachweise und der Legacy-Recoveryweg. S6b bleibt vor produktiven strukturellen Restore-Abläufen zu beheben. S3/S4 sowie S5/S7 folgen nach Betriebspriorität. Jede weitere Umsetzung braucht passende Regressionstests und ein neues vollständiges Gate, keine stille Übernahme alter Testergebnisse.
