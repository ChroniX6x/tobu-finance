# H08-NACHTRAG-TESTS: Nachtrag der Testausnahmen (EX-01..EX-06, F-2..F-4)

Schritt / GO: H08-NACHTRAG-TESTS (03.11.2026), nur Tests. Kein Produktcode geändert, keine Migration, kein Restore/Reset, kein Push/Merge/Deploy, kein H09, keine Recurrence-/Activity-Arbeit.

## Stand

- Ausgang: `develop` auf `f187f09` (H08 Wiederholung 2), Arbeitsbaum clean. Branch `test/h08-nachtrag-tests`, Testcommit `a7380e4d9397bfabc739fee82f0c84745735c218`. Lokal, nicht gepusht.
- Umgebung: Windows, Node v24.13.1, npm 11.8.0, Docker 29.9.2, isoliertes Replica-Set über `test-stack`.
- Kein Produktcode: geändert/neu sind nur `apps/web/tests/e2e/*` und `apps/api/tests/integration/month-intervals.test.mjs`. Keine Fixture-, Baseline- oder Manifestanpassung, keine Timeout-Lockerung, keine Retries.

## A/Q

| Gate | Status | Beleg |
| --- | --- | --- |
| Q (Gesamtlauf) | **PASS** | `npm run quality:full`, Exit 0, `quality.json`: Commit `a7380e4…`, Dirty false, 17/17 `passed` (inkl. e2e 175 passed, e2e:real 21 passed, integration, lifecycle, artifact) |
| Zonenmatrix | **PASS** | 5/5, je Exit 0 und 21 passed (siehe unten) |
| Review | ⚠️ keine kritischen Fehler | Konzept-Reviewer, read-only, Befunde unten |
| A | **PASS für die testbaren Ausnahmen; offen: F-3, EX-07, F-1, F-5..F-8** | Matrix unten |

## Matrix: Ausnahme -> Test -> Zone/Uhr -> Status

| Ausnahme | Test | Zone / Uhr | Assertion (Kern) | Status |
| --- | --- | --- | --- | --- |
| EX-01 / CAL-06 | `calendar-picker-zones.spec.ts` (40 Tests) | Playwright `timezoneId`: Europe/Berlin, America/New_York, America/Los_Angeles, Asia/Tokyo, UTC, America/Havana, Pacific/Kiritimati, Pacific/Pago_Pago; keine Fake-Uhr, keine Datumsmocks; echter `calendar-picker.ts` per esbuild gebündelt | Datum <-> BankDate <-> Carrier <-> MonthKey ohne Tagesverschiebung für 15 Tage (DST-Beginn 2026-03-08 NY/Havana, 2026-03-29 Berlin, DST-Ende 2026-10-25/11-01, Jahres- und Schaltjahresgrenze 2028-02-29); Monatswechsel; lokaler Tag für 13 Instants gegen Luxon im Node-Prozess; Setup-Test beweist Zone und DST-Offset | **geschlossen** |
| EX-02 / CAL-08 | `calendar-month-navigation.spec.ts` (36 Tests, zweimal grün) | Berlin, New York, Los Angeles, Tokyo; Uhr 2026-01-01T00:30Z, 2026-12-31T23:30Z, 2028-02-29T23:30Z, 2027-02-28T23:30Z | Chevrons und Monatsauswahl senden exakt `2025-12`, `2027-01`, `2028-03` usw.; Planungs-Picker über den Jahreswechsel | **geschlossen** (Picker-Zellen per `dispatchEvent`) |
| EX-03 / CAL-09 | Code-Beleg + `calendar-instants.spec.ts` (bestehend) | 4 Zonen | Grep in `apps/web/src`: `createdAt` nur als Typfeld (`account-overview.ui-model.ts:55`), `modifiedAt` nirgends, kein Template zeigt sie. Angezeigte Instants: `event.date | date:'dd.MM.'` (getestet), `/calculation` statisch (W25) | **begründet geschlossen**, kein Erzwingungstest |
| EX-04 / CAL-22 | `calendar-wizard.real.spec.ts` (Wizard) | Berlin, NY, LA, Tokyo; Uhr `TOBU_TEST_NOW` bzw. echte Uhr; echte JWT (Registrierung), echtes Mongo | Request und Readback: Balance `month`, Einkommen/Budget `fromMonth` = UTC-Monat der Uhr, 123456/100001/200003/10001/20002 Cent, Basisregel 30003, Vormonat 0, Mitgliederanteile = Summe | **geschlossen** |
| F-4 / CAL-21 | `calendar-wizard.real.spec.ts` (Snapshot) | 4 Zonen, echter Stack | Snapshot 2 Monate zurück: `overview.account.currentMonth`/`summary` = Anker, UI zeigt den UTC-Monat-Label (nicht den lokalen Vormonat), Kalendermonat = Uhr | **geschlossen** |
| EX-05 / CAL-25 | `calendar-dock.real.spec.ts` | 4 Zonen, Uhr 2026-10-31T23:30Z (31.10. USA, 01.11. Berlin/Tokyo), echter Stack, echte Klicks | Dock direkt + Queue: Carrier = lokaler Tag, kein `month`; Split-Kind: Carrier = Parent (31.10., auch in Tokyo), Monat Oktober; Öffnen: 0 PATCH; Titel-PATCH exakt `{title}`; Datums-PATCH `{bookDate:2026-11-01…}`, Parent Monat 11, Kind folgt, 10001/3333 unverändert. 4 Läufe x 4 Zonen grün | **geschlossen** (Dock und Editor) |
| EX-06 / CAL-26 | `calendar-month-filter.spec.ts` (12 Tests) | 4 Zonen, Uhr 2026-12-31T23:30Z | Toolbar-Zeitraum sendet `monthFrom`/`monthTo` = `2026-12`/`2027-02`, `2028-02`/`2028-03`, `2027-01`; Zwischenzustand nur `monthFrom`; Chip-Entfernen löscht beides. Web liest keine Monats-URL, rendert keine Insight-Links (Code-Beleg) | **geschlossen** |
| F-2 / CAL-20 | `month-intervals.test.mjs` (3 neue Tests) | Server-Zonen UTC, Tokyo (frozen 2026-11-30T23:59:59.999Z), Los Angeles (frozen 2026-12-01T00:00Z) | 10001 im Verhältnis 1:2:4 = 1429/2857/5715, gleiche Anteile = 3333/3334/3334, Summe exakt; Snapshots 1234567/250/99999999 in BSON, Summary, Overview identisch; Parent 10001 und Kinder 3333/3333/3335 beim Verschieben unverändert, Totals wandern als Ganzes | **geschlossen** |
| F-3 / CAL-24 | Versuch, nicht eingecheckt | echter Stack | Echtklick auf „Einzahlung buchen“ im Drawer scheitert: `elementFromPoint` am Button = `.p-drawer-mask` (`p-overlay-mask-enter-active`), Drawer `z=1102` liegt im Stacking-Context `layout-content-wrapper` (z=1). Auch ohne Fake-Uhr | **weiter offen**, möglicher UI-Defekt |
| EX-07, F-1, F-5..F-8 | – | – | ausdrücklich ausgenommen | **offen** |

## Befehle und Exitcodes

| Befehl | Exit | Ergebnis |
| --- | --- | --- |
| `npm run typecheck` / `lint` / `format:check` (auf dem Testcommit) | 0 / 0 / 0 | grün |
| `playwright test --project=chromium calendar-picker-zones` | 0 | 40 passed |
| `... calendar-month-navigation` (2 Läufe) | 0, 0 | 36 passed je Lauf |
| `... calendar-month-filter` | 0 | 12 passed |
| Integration `month-intervals.test.mjs` (Test-Stack) | 0 | 16 pass, 0 fail |
| `calendar-wizard.real` + `calendar-dock.real` (Test-Stack, 4 Zonen, `--repeat-each=4` für Dock) | 0 | 17 passed |
| `npm run quality:full` auf `a7380e4` clean | 0 | 17/17 passed |
| `TZ=America/Los_Angeles TOBU_TEST_NOW=2026-10-31T23:30:00.000Z npm run e2e:real` | 0 | 21 passed |
| `TZ=Asia/Tokyo TOBU_TEST_NOW=2026-10-31T23:30:00.000Z npm run e2e:real` | 0 | 21 passed |
| `TZ=UTC TOBU_TEST_NOW=2028-02-29T23:30:00.000Z npm run e2e:real` | 0 | 21 passed |
| `TZ=America/New_York TOBU_TEST_NOW=2026-12-31T23:30:00.000Z npm run e2e:real` | 0 | 21 passed |
| `TZ=UTC TOBU_TEST_NOW=2026-11-01T06:30:00.000Z npm run e2e:real` | 0 | 21 passed |

Logs liegen in `%TEMP%` (nicht im Repo). Zwischenläufe mit Fehlschlägen (Entwicklung der Tests, kein Produktcode): Picker-Overlay-Instabilität (siehe Review), Wizard wartete auf eine URL, Dock-Datums-Save war zunächst flaky (Race: Editor-Modell nach erstem PATCH neu aufgebaut); behoben durch Synchronisation auf gerenderten Zustand (Zeile sichtbar, Save disabled/enabled, Overlay weg), nicht durch Timeouts oder Retries. Zwei temporäre Hilfsskripte (gefilterter Stack-Runner) wurden gelöscht.

## Neue Produktbefunde (nicht behoben, eigener Fix-Schritt nötig; STOP-3/7)

1. **Wizard-Navigation:** `apps/web/src/app/wizard/state/wizard.state.ts` ruft `this.router.navigate(['accounts', accountId])` mit einem **Promise** auf, bevor das Konto existiert. Nach „Next“ landet der Nutzer in `/accounts` mit leerer Liste; die Anlage läuft im Hintergrund weiter (vom Test über die Responses belegt). Nicht kalenderbezogen; der bestehende Mock-Test „navigates away“ erkennt es nicht.
2. **Drawer-Maske (F-3):** Der Echtklick auf den Speichern-Button im Zahlungs-Drawer trifft die Maske. Ob Endnutzer betroffen sind, ist hier nicht belegt (nur Headless-Chromium geprüft). Als Fix-Schritt zu klären (z. B. `appendTo="body"` oder Stacking-Context), nicht in diesem Schritt.

## Review (Konzept-Reviewer, read-only, nichts ausgeführt)

Urteil ⚠️, **keine kritischen Fehler**; EX-01, EX-02, EX-04, EX-05, EX-06, F-2 ✅. Offene mittlere/kleine Punkte (nicht vor dem Commit behoben, bewusst, weil ein Gate-Neulauf nötig wäre):

- M1: F-3 offen, kein `test.fixme`; Defekt nur im Bericht/Doku geführt.
- M2: `seen.incomes` im Wizard-Test wird nach dem Warten auf Budgets ohne eigene Synchronisation gelesen (Annahme „Einkommen vor Budgets“); der Readback über die API schützt, aber ein Warten auf die Income-Responses wäre sauberer.
- M3: Im Fall „Dezember“ wählt `pick(11, year)` denselben Monat erneut und erwartet trotzdem einen Request (koppelt an `onPickerMonthSelect` lädt immer neu).
- M4: Snapshot-Test: Regex `988 €` und `getByText(label).first()` sind locker; die Cent-Werte sind über die API-Asserts belegt.
- M5: Ohne `TOBU_TEST_NOW` rechnet der Wizard-Test mit der echten Uhr; um die UTC-Monatsgrenze minimales Race-Risiko.
- Klein: `dispatchEvent('click')` für Picker-Zellen/-Pfeile und Chip-Entfernen (Handler-, nicht Nutzerbeleg); numerisches `.sort()` ohne Komparator (gleiche Ziffernzahl); `networkidle` an zwei Stellen; Zone mit halbstündigem Offset fehlt; EX-03 ohne Erzwingungstest.

## Offene Risiken

- F-3 (Drawer) und die zwei Produktbefunde oben; EX-07/A17, F-1, F-5..F-8 unverändert offen (F-5: Negativlauf gegen den Vor-Fix-Stand wurde nicht versucht).
- CI der PRs nicht eingesehen; echte Nutzerdaten nicht auditiert; Aussagen zu EX-03 beruhen auf Codesichtung am Stand `a7380e4`.
- Die `real`-Specs registrieren pro Test einen eigenen Nutzer (Login ist auf 10 pro 10 Minuten begrenzt); die DB ist isoliert und wird mit dem Test-Stack entfernt.

## Rollback

Reiner Test- und Markdown-Schritt: Revert der beiden Commits (Tests `a7380e4`, Doku danach) oder Branch `test/h08-nachtrag-tests` verwerfen. Keine Daten, kein Schema, kein Produktcode betroffen.

STOP bis zum nächsten ausdrücklichen GO.
