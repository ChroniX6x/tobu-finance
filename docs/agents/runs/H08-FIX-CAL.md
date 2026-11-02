# H08-FIX-CAL – bookDate-Carrier und monatsgenaue Basisregeln

Schritt / GO: H08-FIX-CAL (Fix-Schritt vor Wiederholung von H08), Medium-Befunde 1–3 aus [H08.md](H08.md). Kein H09, keine Recurrence-Arbeit, keine Migration, kein Push/Merge.

## Stand

- Branch `feat/h08-fix-cal` ab `develop` `9ef5662` (enthält H08-FIX-ACL, Merge PR #14). Gate-Commit `c772a95dc0e18191aa5e9aec6f9561f01d94c8a5`, Arbeitsbaum clean. Danach nur dieser Bericht. Lokal, nicht gepusht.
- Umgebung: Windows, Node v24.13.1, npm 11.8.0, Docker (isoliertes Replica-Set über `test-stack`, keine Dev-/Prod-Daten).
- Eigentümerentscheidung zu A29 (Rückfrage, 02.11.2026): Basisregeln monatsgenau; ein Monat zählt nur die in ihm gültigen Budgets; keine pauschale Neugenerierung; Bestandsdatenkorrektur separat und nur mit Freigabe.

## Ergebnis je Befund

| Befund | Ergebnis |
| --- | --- |
| 1 `bookDate` (A03/CAL-05) | **behoben** |
| 2 `regenerateBaseRules` (A29) | Rückwirkung **per Test belegt und behoben**, Austausch **atomar**, Budget+Event+Regeln in **einer** Transaktion |
| 3 `recurrences.ts` `activeFrom` (A17) | **nicht angefasst**, offen/separat (Begründung unten) |

### 1) bookDate-Carrier

- [transactions.ts](../../../packages/contracts/src/transactions.ts): `CreateTx`/`PatchTx` verwenden `BookDateWriteSchema` = `BankDateCarrierSchema` (aus `@tobu/contracts/calendar`) oder `z.string().datetime()`. Kein zweites Format, keine eigene Regex.
- Übergangsregel (dokumentiert im Contract, in `contracts.md` und `date-month-semantics.md`): Ein Nicht-Träger (z. B. `…T23:30:00.000Z`) passt durch das Schema nur, damit der Server einen unveränderten gespeicherten Wert erkennen kann. [transaction-dates.ts](../../../apps/api/src/lib/transaction-dates.ts) akzeptiert ihn **nur als Echo des gespeicherten Werts** (PATCH derselben Buchung = No-op; Split-Kind eines Parents mit genau diesem Wert), sonst `422 BOOKDATE_NOT_CARRIER` ohne Schreibzugriff und ohne Event. Der Echo-Vergleich ist „gleicher Instant", nicht „gleicher String" (Reviewer-Hinweis, bewusst altclient-freundlich).
- Historische Daten bleiben unverändert: kein Umschreiben beim Lesen, kein Write bei unverändertem PATCH, Kind erbt den gespeicherten Altwert unverändert. Der Weg aus einem Altwert ist ein PATCH mit einem Träger (Parent und Kinder wandern gemeinsam).
- Folge für Bestandsdaten: Seed-Buchungen können `bookDate` mit Uhrzeit enthalten; ein neues Kind unter einem Altwert-Parent funktioniert nur als Echo, ein Träger-Kind unter Altwert-Parent ergibt `CHILD_DATES_MUST_MATCH_PARENT` (bestehendes Verhalten).
- OpenAPI neu generiert, Consumer-Tests angepasst/ergänzt (siehe Tests).

### 2) regenerateBaseRules

- **Belegt (vor dem Fix):** Test „A29 characterization" zeigte: Budget A 10.000 ab 2026-01, danach Budget B 5.000 ab 2026-11 ⇒ `month-view` März 2026 `totalDueMinor` 10.000 → 15.000. Ursache: eine Basisregel über die ganze Spanne mit der Summe der im **aktuellen** Monat aktiven Budgets. Der vorhandene CAL-20-Generatortest hatte dieses Verhalten festgeschrieben.
- **Fix** ([contribution-rule-generator.ts](../../../apps/api/src/services/contribution-rule-generator.ts)): `amountPeriods` bildet Zeiträume konstanter Summe pro `customSplit`-Gruppe (Änderungen nur am Budget-Start und im Monat nach dem Ende; Lücken bleiben Lücken; zusammenhängende gleiche Summen werden zusammengefasst). Keine Uhr mehr im Generator.
- **Atomar:** [category-budgets.ts](../../../apps/api/src/routes/category-budgets.ts) schreibt Budget, Event und den Austausch der Basisregeln (Löschen + Einfügen) in **einer** MongoDB-Transaktion; ein vorheriger Schreibzugriff auf das Konto serialisiert parallele Budget-Schreibvorgänge desselben Kontos. Review-Befund 1 (Race/Lost Update, Budget ↔ Regeln nicht gemeinsam atomar) wurde damit behoben.
- **Keine pauschale Neugenerierung:** Es läuft kein Bulk-Job. Bestehende gespeicherte Basisregeln werden erst ersetzt, wenn ein Budget **dieses Kontos** geschrieben wird (das war schon vorher so: jede Budget-Änderung baut die Regeln des Kontos komplett neu). Test: ein Budget-Write ändert die Regeln eines anderen Kontos nicht (byte-gleich).
- **Bestandsdatenkorrektur: nicht durchgeführt, braucht eigene Freigabe.** Konten mit früher erzeugten (falsch gespannten) Basisregeln zeigen Vergangenheitsmonate erst nach der nächsten Budget-Änderung dieses Kontos monatsgenau. Eine gezielte Korrektur wäre ein Datenlauf und ist nicht erfolgt.

### 3) recurrences.ts (A17)

Nicht angefasst. Begründung: Schritt 1 und 2 berühren die Legacy-Route nicht; sie ist eine Legacy-Route ohne Kontoprüfung (AUTH-001 offen) und wird mit P02 abgelöst; eine Teilkorrektur hier würde P02 vorwegnehmen. Der Fehler bleibt als **bekannte Fehlfunktion** offen (`new Date()` als `activeFrom` ohne Monatsanker/`lib/clock`, dadurch im Anlagemonat inaktiv). Doku-Status A17: `SEPARATE-TICKET`, mit Hinweis.

## Tests (Änderungen)

- Contract: `contracts.test.mjs` (Träger ok; `2026-04-12`, `not-a-date`, Monat 13, 29.02. im Nichtschaltjahr abgelehnt; Nicht-Träger als Übergangskandidat). Die Datei wurde dafür komplett Prettier-formatiert (Format-Baseline), daher großer Diff.
- Unit `transaction-dates.test.mjs`: Der Test „UTC-Monat eines Legacy-Instants bleibt erhalten" beschrieb das abgelöste Verhalten und wurde durch Tests für die neue Regel ersetzt (Echo ok, sonst `BOOKDATE_NOT_CARRIER`). Das ist eine bewusste Verhaltensänderung, kein Kaschieren.
- Unit `contribution-rule-generator.test.mjs` (neu, 6 Tests): spätere Budgets ändern frühere Monate nicht; Ende+Folgebudget; Überlappung; Lücken/Merge; unbegrenzter Start/Ende, Jahreswechsel, Schaltjahr; invertierte Budgets und Jahr 9999; Orakel Monat-für-Monat 2024–2029 mit umgekehrter Reihenfolge.
- Integration `transaction-dates.test.mjs`: CAL-05/A03 (Träger nötig, 23:30Z/10:00Z abgelehnt, Kind mit anderem Wert abgelehnt, Lesen verändert nichts, Echo ist No-op, Kind erbt Altwert, Träger-PATCH bewegt Parent und Kind; jeweils Snapshot vor/nach = 0 Writes, 0 Events); A29-Atomarität (Failpoint: Budget, Event und Regelaustausch rollen gemeinsam zurück); A29-Parallelität (5 parallele Budget-Writes ⇒ genau eine Basisregel, Summe = gespeicherte Budgets).
- Integration `month-intervals.test.mjs`: der CAL-20-Generatortest erwartet jetzt die monatsgenauen Regeln (bisher: eine Regel mit dem Betrag des aktuellen Monats); er läuft auf Tokyo-, LA- und UTC-Server mit gleichem Ergebnis. Neu: A29 Mehr-Budget-Szenario über `month-view` (spätere/ablaufende/zeitlich begrenzte Budgets ändern nur ihre Monate) und „nur eigenes Konto".
- Nicht geändert: Testfixtures zum Kaschieren, Baseline, Migrationsmanifeste.
- **Nicht umgesetzt (optional):** Tests für CAL-25 Dock-Create/-Edit und CAL-06 Picker in mehreren Zonen. CAL-06/22/25 bleiben „teilweise" (Doku: W06, W07, W08, W17 auf `TEILWEISE` gesetzt).

## A-/Q-Gates

| Gate | Status | Beleg |
| --- | --- | --- |
| A-CAL-1 (A03/CAL-05) | **PASS** | Contract-, Unit-, HTTP-Tests, 0 Writes bei Ablehnung |
| A-CAL-2 (A29) | **PASS** | Rückwirkung belegt und behoben; Atomarität und Parallelität getestet |
| A-CAL-3 (A17) | **offen / nicht bearbeitet** | siehe oben |
| Q-CAL | **PASS** | `quality:full` Exit 0, 17/17 `passed`, Commit `c772a95`, dirty false, Dauer 12,5 min |
| Zonenmatrix `e2e:real` | **PASS** | je 9 passed, Exit 0 (LA, Tokyo, UTC-Schaltjahr; siehe Tabelle) |

Nicht behauptet: H08 ist nicht wiederholt, A-H08 nicht erneut bewertet. `categories`/`recurrences` bleiben ungeschützt (H08-FIX-ACL). CAL-06/22/25 sind weiter nur teilweise belegt.

## Befehle und Exitcodes

- `npm run typecheck`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:workspace`, `npm run check:contracts`: Exit 0.
- `npm run test:contracts` 17/17, `npm run test --workspace=@tobu/api` (Unit) 33/33: Exit 0.
- Einzelläufe der Integrationsdateien `transaction-dates`, `month-intervals`, `account-access` gegen temporäres Replica-Set: Exit 0.
- `npm run quality:full` auf `c772a95`: **Exit 0**, `test-results/quality.json`: Commit `c772a95…`, Dirty false, 17/17 `passed` (workspace, format, lint, typecheck, contracts, test:contracts, build, tooling, api, web, e2e, replica, integration, e2e:real, lifecycle, package:artifact, test:artifact).
- Zonenmatrix (auf demselben Commit, Aufruf `$env:TZ=…; $env:TOBU_TEST_NOW=…; npm run e2e:real`, Logs in `%TEMP%\h08cal`, nicht im Repo):

| Backend-TZ | Server-/Browser-Uhr (UTC) | Abdeckung | Ergebnis |
| --- | --- | --- | --- |
| America/Los_Angeles | 2026-10-31T23:30Z | negativer Offset, Monatsende | 9 passed, Exit 0 |
| Asia/Tokyo | 2026-10-31T23:30Z | positiver Offset | 9 passed, Exit 0 |
| UTC | 2028-02-29T23:30Z | Schaltjahr | 9 passed, Exit 0 |

- Frühere Zwischenfälle im Lauf: Prettier-Format (Pflichtdateien), Fixture-Fehler in meinen neuen Tests (Zod-Regeln, Legacy-Monat), Failpoint-Zähler (Kategorie-Insert verbrauchte die Zählung). Alles in den Tests behoben, nicht im Produktcode.

## Datenunveränderheit (Counts + Schema)

Einmalige Evidenz (Skript im Session-Ordner, nicht im Repo): temporäres Replica-Set, `init` + `seed`, danach Snapshot je Collection (Anzahl, SHA-256 über alle Dokumente, SHA-256 über die Indexdefinitionen), dann API gegen dieselbe DB, Login als Demo-Nutzer, 5 Konten × 9 lesende Routen (`/accounts/:id`, `month-view`, `overview`, `planning`, `master-data`, `expanded`, `transactions`, `contribution-rules`, `category-budgets`) = 45 Requests, alle 200; erneuter Snapshot: **identisch** (`unchanged: true`; ohne `auth_sessions`, die der Login schreibt).

| Collection | Anzahl vorher = nachher |
| --- | --- |
| account_balances 46, accounts 8, carryovers 1, categories 24, category_budgets 1, contribution_rules 8, events 0, member_incomes 13, members 6, recurrences 1, transactions 85, users 8, `_tobu_schema` 1, `_tobu_seed` 1 | Daten-Hash und Index-Hash unverändert |

Grenze: In diesem Lauf fanden sich keine Seed-Buchungen mit Nicht-Träger-`bookDate` für die PATCH-Probe (`patches: 0`); das Verhalten (Echo = No-op, andere Werte 422, 0 Writes) ist durch die Integrationstests belegt, nicht durch diesen Lauf. Es wurden keine Migration, kein Restore, kein Reset und keine Änderung an Baseline/Migrationen vorgenommen (`git diff` enthält nichts unter `src/database`).

## Review

Konzept-Reviewer (read-only) auf dem Arbeitsstand: ⚠️, kein Critical. Behoben vor dem Commit: Befund 1 (Race/Atomarität Budget ↔ Regeln), 2 (Tests Atomarität/Parallelität), 3 (Randtests), 8 (Doku „atomar"). Dokumentiert: Befund 5 (Echo ist Instant-Gleichheit), 9 (A17 offen). Befund 6 (Echo bei abweichendem Legacy-Monat ist bewusster No-op) ist durch den bestehenden Test „legacy rows are never re-derived" abgedeckt. Kein erneutes Review nach den Fixes.

## Offene Risiken

1. A17 (Legacy-Recurrence `activeFrom` ohne Monatsanker) bleibt eine aktive Fehlfunktion.
2. Bestehende Basisregeln wurden nicht korrigiert; Bestandskonten zeigen Vergangenheitsmonate erst nach der nächsten Budget-Änderung monatsgenau. Eine Bestandsdatenkorrektur braucht Freigabe.
3. Für Konten mit mehreren Basisregeln je Gruppe (neu) ist die UI nicht eigens geprüft; die Leser filtern nach Monat und summieren je aktiver Regel (laut Review kompatibel), der Planungstitel „Basisbedarf (Custom Split)" ist bei mehreren Gruppen nicht eindeutig (schon vorher).
4. Clients, die `bookDate` mit Uhrzeit für **neue** Werte senden, bekommen jetzt 422. Web sendet Träger; unbekannte Altclients nicht geprüft.
5. Seed-Buchungen mit Uhrzeit-`bookDate` bleiben Altwerte (Bereinigung = eigene freigabepflichtige Datenmaßnahme).
6. CAL-06/22/25 nur teilweise; DST-Frühling nicht getestet. Die Zonenmatrix wurde nur für `e2e:real` wiederholt.
7. Die Budget-Routen schreiben jetzt in `accounts.updatedAt` (Serialisierung); das ändert `updatedAt` des Kontos bei jedem Budget-Write.

## Rollback

`git revert c772a95` (plus Bericht-Commit). Keine Migration, keine Schemaänderung, keine Datenänderung. Nach dem Revert gelten wieder: beliebige ISO-`bookDate` (A03 offen), eine Basisregel über die ganze Spanne (A29 offen, Rückwirkung). Von neuem Code erzeugte monatsgenaue Basisregeln bleiben gültige Dokumente und werden bei der nächsten Budget-Änderung vom alten Code ersetzt.

STOP bis zum nächsten ausdrücklichen GO (H08-Wiederholung, A17/Recurrence, CAL-06/25-Tests, Bestandsdatenkorrektur).
