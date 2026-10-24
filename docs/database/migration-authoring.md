# Migrationen: Anforderungen an nachfolgende Agents

Stand: Abschnitt 3. Transaktionaler und kontrollierter struktureller Modus sind implementiert; die Docker-Abnahme von Abschnitt 3 steht aus. Für Strukturänderungen zusätzlich [Strukturelle Migrationen](structural-migrations.md) lesen. Der [Umsetzungsstand](migration-progress.md) trennt Implementierung und Nachweise.

## Neue transaktionale Migration erstellen

1. Im Repository-Root `npm run db:migration:create -- beschreibender-name` ausführen. Der Generator legt genau eine neue Datei unter `apps/api/src/database/migrations` an. Keine Legacy-Dateien verschieben und den Baseline-Snapshot nicht ändern.
2. `description`, `namespaces`, `preUp`, `up`, `verifyUp`, `preDown`, `down`, `verifyDown` ausarbeiten. Unfertige Templates werfen absichtlich Fehler. Der Vorgänger ist die unmittelbar vorhergehende Migration; keine Lücken oder unabhängigen Zweige.
3. Nur den bereitgestellten Kontext verwenden: `findOne`, begrenztes `findMany`, `count`, `insertOne`, `updateMany`, `deleteMany`. Jede Operation einzeln `await`en. Keine parallelen Aufrufe, keine eigene Verbindung, keine DDL, keine HTTP-/Datei-Nebenwirkungen. Collections müssen bereits existieren. Datenumstrukturierungen, die diese Grenzen überschreiten, verwenden den separat bestätigten strukturellen Modus.
4. Migrationslogik bleibt in der Datei; nur Type-Imports sind erlaubt. Veränderliche Runtime-Helfer würden die historischen Prüfsummen umgehen. Das ist eine Regel für vertrauenswürdigen Projektcode, keine Sicherheits-Sandbox.
5. Datei formatieren, dann `npm run db:migration:manifest`. Datei und generierten Katalog gemeinsam reviewen und committen. Der Build lehnt veraltete Prüfsummen ab. Nach bereits ausgeführtem Up bleibt die Datei auch nach Down unveränderlich.
6. Eigene Integrationstests für Vorbedingungen, Up/Down, Nachbedingungen und Fehler nach Writes ergänzen. Keine Produktionsmigration nur für einen Test erzeugen. `npm run test:integration`, danach `npm run quality:full` ausführen. Ein geänderter Datenbestand muss gegenüber einer frischen Baseline plus denselben Migrationen fachlich gleichwertig sein.

## Bestehende Datenbank migrieren

DB muss laufen und eine bekannte Baseline enthalten. Vor Schreibbefehlen API/Web sowie sämtliche externen Writer/Jobs stoppen; alle laufenden Schreibvorgänge müssen abgeschlossen sein. Die Root-Befehle prüfen zusätzlich freie API-/Web-Ports. Sie starten keine Datenbank und seeden nichts. Vorher einmal Setup/Build ausführen, damit das gemeinsame Vertragspaket gebaut ist.

```powershell
npm run db:migrate:status
npm run db:migrate:plan
npm run db:migrate -- --confirm=<confirmation-aus-dem-plan> --writers-stopped=tobu_finance_dev
```

Plan kontrollieren: Umgebung, Server, Datenbankname, Datenbank-ID, Ausgangsstand und Migrationen. Der Bestätigungshash bindet zusätzlich Verbindungsoptionen und Prüfsummen. Bei Änderungen neu planen. Bei alten Baselines ohne ID wird die ID mit der ersten echten Migration atomar ergänzt; neue Baselines erhalten sie direkt. Status/Plan ändern keine Datenbankdaten. Ein leerer Up-Plan ist ein No-op.

Down nimmt genau die letzte erfolgreich ausgeführte Migration zurück:

```powershell
npm run db:migrate:plan -- --direction=down
npm run db:migrate:down -- --confirm=<confirmation-aus-dem-down-plan> --writers-stopped=tobu_finance_dev
```

Die Garantie gilt pro transaktionaler Migration. In einem Stapel können frühere Migrationen bereits committed sein, wenn eine spätere scheitert. Schema-Marker, Daten und Historie werden pro Migration atomar gespeichert. Reine Datenmigrationen behalten das jeweilige Collection-Schema bei. Strukturelle Übergänge erweitern den versionierten Schema-Stand über `schemaChanges`; die historische Baseline bleibt unverändert.

## Transaktionaler Abbruch und unklare Commit-Ergebnisse

Nach einem Fehler bleibt die exklusive Sperre erhalten, auch wenn der Treiber die Daten bereits zurückgerollt hat. Readiness und API-Zugriffe einschließlich Auth melden Wartung. Ein normaler App-Start migriert nicht automatisch. Sperren niemals manuell löschen und keinen Down auf Verdacht ausführen.

1. Sicherstellen, dass der alte Runner wirklich beendet ist und alle Writer weiter gestoppt bleiben.
2. `npm run db:migrate:plan` ausführen. Run-ID unter `recovery.runId` und neuen Bestätigungshash prüfen.
3. `npm run db:migrate:recover -- --confirm=<hash> --runner-stopped=<run-id> --writers-stopped=tobu_finance_dev` ausführen.
4. Ergebnis `committed` oder `not-committed` prüfen, neu planen und bei Bedarf explizit fortsetzen. Recovery startet keine Migration und verändert keine Fachdaten.

Recovery entfernt die Sperre und prüft die atomare Historie innerhalb einer Transaktion. Ein alter konkurrierender Commit wird durch den Schreibkonflikt an derselben Sperre verhindert. Eine ausgeführte Operation kann daher nicht nachträglich hinter einer erfolgreich freigegebenen Sperre committen. Die Recovery wartet begrenzt auf noch serverseitig offene Transaktionen; bei Timeout bleibt die Sperre bestehen. Migrationsbudget 60 Sekunden, Commitbudget 15 Sekunden, Recoverybudget 120 Sekunden. Das garantiert keine Erfolgsmeldung bei einem dauerhaft unerreichbaren Server.

Produktiv wird direkt `node apps/api/dist/src/database/migration-cli.js plan` bzw. `up`, `down`, `recover` mit denselben Bestätigungsargumenten ausgeführt. `NODE_ENV=production` und `MONGODB_URI` kommen aus dem Deployment, nicht als URI-Kommandozeilenargument. Die Dev-CLI bleibt produktiv gesperrt. Die produktive Betriebsfreigabe bleibt separat. Strukturelle Recovery hat andere Garantien und zusätzliche Pflichtargumente: siehe [Betriebsanleitung](structural-migrations.md).

## Vor dem Schreiben

1. Tatsächlichen Datenbankstand, Zielstand und zulässige Vorgänger bestimmen. Unbekannte Versionen ablehnen, nicht automatisch umbenennen oder übernehmen.
2. Datenänderungen von Validator-, Index- und Collection-Operationen unterscheiden. MongoDB-Transaktionen benötigen ein Replica Set oder einen Sharded Cluster. Nicht alle Schemaoperationen sind darin zulässig.
3. Laufzeitkompatibilität und Wartungsbedarf festlegen. Migrationen dürfen nicht mit unkoordinierten App-Schreibzugriffen konkurrieren. Alle beteiligten Schreibzugriffe und der Migrationseintrag müssen zur zugesagten Atomizität passen.
4. Die Ausgangsbaseline unveränderlich halten. Aktuelle Mongoose-Modelle allein sind kein eingefrorener historischer Schema-Snapshot. Eine geänderte Baseline darf nicht dazu führen, dass eine neue Datenbank denselben Übergang doppelt erhält oder bestehende Datenbanken nicht mehr migrierbar sind.
5. Vor riskanten Operationen eine unabhängig wiederherstellbare Sicherung und einen getesteten Wiederherstellungsweg verlangen. Ein erfolgreiches `down` ersetzt kein Backup.

## Up und Down

- Jede Migration erhält eine eindeutige, stabile Kennung, `up` und `down` sowie eine Beschreibung ihrer Vor- und Nachbedingungen. Keine bereits ausgeführten Dateien nachträglich ändern.
- `up` führt ausschließlich den angegebenen Übergang aus. Keine Seeds, Passwortrücksetzungen, fremden Datenbanken oder historischen Migrationen nebenbei ausführen.
- `down` beschreibt die fachliche Rücknahme eines **bereits erfolgreich committed** Up. Das automatische Abbrechen einer fehlgeschlagenen Transaktion ist etwas anderes; nicht blind `down` auf einen teilweise ausgeführten Up anwenden.
- Ist eine Transformation informationsvernichtend, muss die Wiederherstellung der alten Werte vorab entworfen und getestet sein. Beispielsweise lassen sich entfernte individuelle Werte nicht durch einen pauschalen Default rekonstruieren. Eine nicht rückführbare Migration darf nicht als reversibel ausgegeben werden.
- Down muss auch bei inzwischen neu angelegten oder bearbeiteten Daten sicher sein. Inkompatible Zustände ausdrücklich ablehnen, statt Daten still zu löschen.
- Migrationsreihenfolge und Versionsprotokoll müssen zum tatsächlichen Datenstand passen. Ein Fehler beim Speichern des Migrationseintrags darf keinen bereits veränderten, aber als unmigriert markierten Zustand hinterlassen.

## Fehlergarantien

- Alle Datenoperationen einer atomaren Migration müssen dieselbe MongoDB-Session verwenden; auch die Umzug-Buchführung muss atomar gekoppelt sein. Eine Sammlung einzelner atomarer Updates ergibt noch keine atomare Migration.
- Innerhalb einer Transaktion keine parallelen Datenbankoperationen. Fehler weiterwerfen; nicht protokollieren und anschließend Erfolg melden.
- Der Treiber kann Transaktionscallbacks wiederholen. Keine E-Mails, Dateischreibvorgänge, HTTP-Nebenwirkungen oder andere nicht transaktionale Aktionen im Callback. Berechnungen müssen wiederholbar sein.
- Bei Verbindungsabbruch während Commit kann der Client zunächst nicht wissen, ob die gesamte Transaktion committed wurde. Niemals in diesem Fall behaupten, sie sei sicher zurückgerollt. Keine kompensierende Down-Migration auf Verdacht; nach Wiederverbindung den atomar gespeicherten Stand bestimmen.
- Nicht unterstützte Operationen müssen vor Schreibbeginn abgelehnt oder über einen gesondert freigegebenen Ablauf behandelt werden. Backup plus Restore ist kein sofortiger atomarer Rollback: Auch Restore und Prozess können unterbrochen werden.
- Protokolle dürfen keine Passwörter, Tokens oder vollständigen privaten Finanzdatensätze enthalten.

## Verpflichtende Tests

Nur isolierte Testdatenbanken benutzen. Für jede neue Migration mindestens:

- Unterstützter Vorgänger → Up → erwarteter Daten-, Validator- und Indexstand.
- Up → Down: vollständige Daten inklusive IDs, Beziehungen, Geldbeträge und Datentypen erhalten beziehungsweise korrekt wiederhergestellt.
- Erneutes Ausführen: keine doppelte Transformation; Versionsprotokoll konsistent.
- Transaktionaler Fehler nach mindestens einer tatsächlichen Änderung: nach Abbruch genau der vorherige Datenbestand, keine vorgezogene Versionsmarkierung.
- Transaktionaler Fehler innerhalb Down: der vorherige erfolgreiche Up-Stand bleibt vollständig bestehen.
- Struktureller Fehler innerhalb Up oder Down: Anwendung bleibt gesperrt, Teilstand wird erkannt, kontrollierte Wiederaufnahme oder verifizierte Wiederherstellung stellt einen definierten Stand her. Auch den Abbruch des Restore testen; keine sofortige Atomizität behaupten.
- Prozessabbruch, konkurrierende Runner und Verbindungsverlust während Commit: definierter, erkennbarer Zustand; kein stilles Fortsetzen mit unbekanntem Ergebnis.
- Unbekannte, fehlende oder manipulierte Migrationseinträge: Abbruch ohne Änderungen.
- Frische Baseline plus neue Migrationen entspricht dem migrierten Vorgängerstand. Seeds sind davon unabhängig.
- Kompiliertes Produktionsartefakt enthält aktive Migrationen und benötigt keinen TS-Runner; Legacy-Dateien bleiben ausgeschlossen.

Agenten müssen beim Handover Befehle, getestete Ausgangsstände, Rollbacknachweise, Laufzeitgrenzen und verbleibende Einschränkungen nennen. Eine reine Mock-Prüfung genügt nicht als Atomizitätsnachweis.

## Referenzen

- [MongoDB: Transaktionen und unterstützte Deployment-Typen](https://www.mongodb.com/docs/manual/data-modeling/enforce-consistency/transactions/)
- [MongoDB: eingeschränkte Operationen in Transaktionen](https://www.mongodb.com/docs/manual/core/transactions-operations/)
- [Node-Treiber: Sessions, Wiederholungen und Commit-Fehler](https://www.mongodb.com/docs/drivers/node/v6.x/crud/transactions/)
- [Umzug: Migrationen und Storage-Anbindung](https://github.com/sequelize/umzug)
