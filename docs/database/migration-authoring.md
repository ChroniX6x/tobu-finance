# Migrationen: Anforderungen an nachfolgende Agents

Stand: 23.10.2026. **Der aktive Umzug-Runner ist noch nicht ergänzt.** Diese Anleitung definiert die Anforderungen; konkrete Erstellungs- und Ausführungsbefehle folgen mit der Umsetzung. `db:migrate` prüft derzeit nur den Baseline-Stand. Gewählt sind transaktionale Migrationen als Standard und ein kontrollierter struktureller Modus. Die [Architektur](migration-architecture.md) wurde vom Nutzer freigegeben; der [Umsetzungsstand](migration-progress.md) unterscheidet implementierte Grundlagen und noch offene Runner-/Recovery-Funktionen.

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
