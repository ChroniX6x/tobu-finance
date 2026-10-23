# Phase 0 – Funktions- und Szenariomatrix

Diese Matrix definiert spätere Abnahmen. Sie ist kein Bericht bereits bestandener Funktionstests. Daten werden synthetisch neu erstellt; UI-Demos und automatisierte Fixtures bleiben getrennt. Alle Geldwerte unten sind Minor Units (Cent).

## Bestehende Funktionen, die erhalten bleiben müssen

| Bereich | Quelle im heutigen Frontend / API | Verbindliche Abläufe |
| --- | --- | --- |
| Anmeldung | `core/auth`, API `auth/routes.ts` | Login, ungültiges Passwort, deaktivierter Nutzer, Refresh, Logout, geschützte Route |
| Kontenliste | `accounts`, API `accounts-summary.ts` / `accounts.ts` | Eigene Konten, Leerzustand, Navigation, Saldo und Mitgliederzahl |
| Kontoübersicht | `accounts/account-overview`, API `account-overview.ts` | Kennzahlen, Verlauf, Warnungen, Kategorien, Mitglieder und Events |
| Monatsansicht | `accounts/month-view`, API `month-view.ts` | Monatswechsel, Beiträge, Zahlungen, offene Beträge, private Vorleistungen, Budgets |
| Buchungen | `transactions`, API `transactions.ts` | Anlegen/Ändern/Löschen, Capture-Dock/Tastatur, Filter, Pagination, Status, Splits |
| Stammdaten | `accounts/account-management/master-data`, API `master-data.ts` und CRUD-Routen | Kontoname, Mitglieder, Owner-Konsistenz, Kategorien und Aufteilungen |
| Planung | `accounts/account-management/planning`, API `planning.ts`, Budget-/Beitrags-/Einkommensrouten | Referenzmonat, Gültigkeitszeiträume, Einkommen, Budgets, Regeln und Verteilung einschließlich Rundung |
| Einrichtungswizard | `wizard`, API Mitglieder/Konten/Kategorien | Schritte durchlaufen, zusammenhängende Daten speichern, Navigation danach |
| Berechnungsseite | `calculation` und zugehöriger Service | Vorhandene erreichbare Funktion erhalten; alte Mock-/DB-Zugriffsteile vor Umzug gesondert prüfen |

Vorhandene 50 Playwright-Tests in 6 Dateien betreffen Kontenliste, Kontoübersicht, Buchungen, CRUD-Verträge, Tastatur und Wizard. Für Planung, Stammdaten, Monatsansicht und echte Rechteprüfung ist damit noch keine vollständige automatisierte Abdeckung belegt.

## Geplante manuelle Szenarien

| ID | Ausgangslage | Konkrete Erwartung / Prüfschwerpunkt |
| --- | --- | --- |
| D01 | Aktiver Nutzer ohne Kontozuordnung | Verständlicher Leerzustand; Wizard erreichbar |
| D02 | Konto mit Owner und minimalen Stammdaten, keine Buchungen | Keine NaN-/undefinierten Kennzahlen; keine erfundenen Zahlungen |
| D03 | Owner A und Member B, Einkommen 200000 / 100000, gültige proRata-Regel 30000 | Verteilung 20000 / 10000; Planung und Monatsdarstellung konsistent |
| D04 | Drei Mitglieder, Einkommen jeweils 0, proRata-Regel 10000 | Implementierter Gleichverteilungsfallback: Gesamtsumme exakt 10000, Einzelanteile 3334/3333/3333; deterministische Zuordnung festlegen |
| D05 | CustomSplit 60/40, Regel 10001 | Anteile 6001 / 4000, Summe exakt 10001 |
| D06 | perMember-Regel 12500 für Mitglied B | Gesamter Betrag B zugeordnet; kein ungewolltes Duplizieren auf alle Mitglieder |
| D07 | Kategorie-Budget 10000 mit Ausgaben 8000, 10000 oder 12000 in getrennten Vergleichsmonaten | Unter Budget, genau erreicht, um 2000 überschritten; keine Vermischung der Monate |
| D08 | Vorgemerkte Ausgabe ohne bookDate, aber gültigem month; gebuchte Ausgabe mit Datum | Erstellen, Statuswechsel und Monatszuordnung funktionieren mit gemeinsamem Vertrag |
| D09 | Parent 10000 mit Children 3000+2000; zweiter Parent vollständig 6000+4000 zugeordnet | Rest 5000 beziehungsweise 0; Aggregationen zählen keine Beträge doppelt |
| D10 | Private Vorleistung eines Mitglieds und nicht kategorisierte Ausgabe | Mitglied/Quelle korrekt angezeigt; Filter für nicht kategorisierte Buchungen funktioniert |
| D11 | Beiträge unbezahlt, teilweise bezahlt, genau bezahlt in getrennten Fällen | Erwartete offenen Beträge aus vorgegebenen Summen; Ergebnis nicht mit Produktionsfunktion erzeugen |
| D12 | 6 abgeschlossene Monate, aktueller Monat und Folgemonat; Salden einmal vollständig, einmal lückenhaft | Monatswechsel, Verlauf, Staleness-/Lückenwarnungen und Referenzmonat der Planung |
| D13 | Gültige Regeln/Budgets in Vergangenheit, Gegenwart und Zukunft | Aktivität im gewählten Monat; keine Anwendung außerhalb des Zeitraums |
| D14 | Mehr als eine Seite Buchungen und ähnliche Titel | Pagination, Suche, Sortierung und kombinierte Filter bleiben nachvollziehbar |
| D15 | Aktive Nutzer mit Owner-/Member-Zuordnung, separater fremder Nutzer, deaktivierter Nutzer | Rollensichten und Loginfälle; tatsächliche Schreibrechte nach geklärter Rollenmatrix prüfen |

Für weitere Fälle (Überträge, monatliche Recurrence) nur bereits unterstützte Fachregeln verwenden. Negative Eingaben wie ungültige IDs, negative Beträge, unzulässige Split-Summen oder fehlendes Datum bei `booked` in API-Tests erzeugen, nicht als kaputte manuelle Demo-Dokumente speichern.

## Deterministische Test-Fixtures

- Pro Testfall nur benötigte Dokumente anlegen; gemeinsam nutzbare Fabriken für gültige Basisdokumente.
- Fester Testmonat, beispielsweise `2026-04`, und kontrollierte Uhr für datumsabhängige Funktionen. Demo-Seeds dürfen einen beim Initialisieren gespeicherten aktuellen Referenzmonat verwenden.
- Stabile IDs pro Fixture; bei Parallelität eigener Datenbank-/Datensatznamensraum je Worker.
- Auth-Fixtures: aktive, deaktivierte und nicht zugeordnete Nutzer; User-/Member-Referenzen konsistent. Keine dauerhaften echten Zugangsdaten.
- Assertions für D03–D07 verwenden oben definierte Zahlen. Bei D04 muss die Tie-Break-Zuordnung anhand einer expliziten Mitgliederreihenfolge festgelegt werden.
- Real-API-Tests dürfen API-Antworten nicht mit `route.fulfill` ersetzen. Mock-UI-Tests bleiben getrennt und werden gegen gemeinsame Verträge geprüft.
- Ein Seed-Wiederholungstest kontrolliert Anzahl/Referenzen; ein anderer ändert eine Demo-Buchung manuell und prüft, dass `db:seed` diese Änderung erhält.
- Neustarttest: Demo-Datensatz ändern, Container stoppen/starten, Änderung erneut lesen. Test-Reset darf diesen Datensatz nicht berühren.

## Baseline-Abnahme

1. Neue Datenbank initialisieren; erwartete Indizes, Pflichtdaten und Versionsmarker prüfen.
2. Initialisierung wiederholen: keine Duplikate und keine Datenlöschung.
3. Unterbrochenen Aufbau simulieren: eindeutig erkennbar oder wiederholbar abschließbar.
4. Demo-Seed ausführen und Szenarien anhand dokumentierter Summen/Referenzen prüfen.
5. Zukunftsmigrationen auf unterstütztem Vorgängerstand prüfen und mit frischem aktuellen Aufbau vergleichen.
6. Sicherstellen, dass historische Migrationen weder durch Build noch aktive Globs geladen werden.

Diese Tests und Daten werden erst in den dafür vorgesehenen Phasen implementiert.
