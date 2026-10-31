# Datum, Monat und Zeitpunkt: Semantik und Übergabe

Fachliche Notiz zum Date/Month-Umbau (H01–H06). Die technische Referenz der Helfer steht in [contracts.md](contracts.md#datum-und-monat-calendarts), Befehle und Gates in [../development.md](../development.md). Diese Datei hält die Begriffe, die Pflichten für spätere Funktionen, den Status jeder Fundstelle und die Abgrenzung zum noch nicht umgesetzten Account-Zonen-Rollout fest. Sie ist eine Dokumentation, keine Freigabe: weder H08 noch ein Recurrence-/Bank-Schritt ist dadurch abgenommen.

## Die drei Zeitbegriffe

| Begriff | Fachlich | API/JSON | Mongo |
| --- | --- | --- | --- |
| MonthKey | Kalendermonat der Finanzen | `YYYY-MM` in Befehlen, Queries und ReadModels; bestehende Ressourcenantworten behalten den Anker | `Date`, erster Tag `00:00:00.000Z` (Monatsanker) |
| BankDate | Buchungstag der Bank, ein Kalendertag | `YYYY-MM-DDT00:00:00.000Z` (Träger, nie ein echter Zeitpunkt) | `Date`, derselbe UTC-Mitternacht-Träger |
| Instant | echter Zeitpunkt (Events, `createdAt`) | ISO-UTC | `Date` |

Es gibt kein zweites öffentliches BankDate-Format. Der Monat einer datierten Buchung folgt dem Kalendertag (`monthKeyFromBankDate`), nie der Zone von Server oder Browser. Ein Instant darf nie als BankDate/MonthKey interpretiert werden (und umgekehrt); Instants werden nur angezeigt, in der Zone des Betrachters, über `formatInstant`.

## Einzige Quellen im Code

- `@tobu/contracts/calendar` ([calendar.ts](../../packages/contracts/src/calendar.ts)): alle Umrechnungen, Zod-Schemas (`MonthKeySchema`, `MonthInputSchema`, `BankDateSchema`, `BankDateCarrierSchema`, `CanonicalUtcMonthAnchorSchema`) und `currentMonthKey(zone, now)`.
- API: [lib/month.ts](../../apps/api/src/lib/month.ts) (nur Adapter; `utils/date.ts` ist ein dünner Alias), halboffene Monatsspannen über `activeInMonthFilter`, Uhr über [lib/clock.ts](../../apps/api/src/lib/clock.ts) (`TOBU_TEST_NOW` nur mit `NODE_ENV=test`).
- Web: [shared/utils/calendar-picker.ts](../../apps/web/src/app/shared/utils/calendar-picker.ts), der einzige Adapter zwischen PrimeNG-DatePicker (lokales JS-`Date`) und BankDate/MonthKey. Der Picker rechnet ausschließlich mit lokalen Kalenderkomponenten.
- Luxon (gepinnt, immer mit expliziter Zone) für alle übrige Datumslogik; keine zweite Bibliothek.

## Verhalten, auf das man sich verlassen kann

- `POST`/`PATCH /api/transactions`: der Server leitet den Monat aus dem BankDate ab. Widerspruch → `422 MONTH_BOOKDATE_MISMATCH`, ohne Schreibzugriff. Parent, Kinder und Events in einer Transaktion. Details in [contracts.md](contracts.md).
- Eingabe-Monat: `YYYY-MM` oder exakt der UTC-Monatsanker (Übergang). Andere Tage, Uhrzeiten, Offsets werden abgelehnt, nichts wird still korrigiert.
- Monatsspannen sind halboffen gegen den Folgemonat (`from < Beginn(M+1)` und `to >= Beginn(M)`).
- Aktueller Monat der Anwendung ist bis zum Zonen-Rollout der UTC-Monat von Server und UI (`currentMonthKeyUtc`, `currentUtcMonthKey`). `currentMonth` in `/summary` und `/overview` ist der letzte verlässliche Snapshot-Monat, kein Kalendermonat.
- Der Einzahlungs-Drawer sendet nur ein Carrier-BankDate (lokaler Kalendertag des Nutzers), keinen `month`.
- Die Daten-Audit-Befehle sind lesend; es gibt keine Migration (H05, `NO MIGRATION` für Fresh+Seed).

## Pflichten für spätere Funktionen

**Recurrences, Occurrences, Buchen, Verknüpfen, Historie, P04-DTOs** (DEC-0056, plan §18): dieselben Formate wie oben. Keine zweite Datums-/Monatsfamilie, keine neuen Parser, keine eigene Regex. Fälligkeits-/Occurrence-Tage sind BankDate-Träger, Monate MonthKey/Anker, Events `occurredAt` ein echter UTC-Instant. Der „aktuelle Monat“ kommt aus `currentMonthKey(zone, serverNow)` mit vertrauenswürdiger Serveruhr, nie aus Browserzeit. Vor jeder Occurrence-/Ensure-Logik ist die Zonenregel unten umzusetzen; bis dahin gilt UTC. Die bestehende `/api/recurrences`-Route ist Legacy (sie speichert ohne `activeFrom` den aktuellen Zeitpunkt) und ist keine Vorlage.

**Bank-/Import-Adapter:** Der Buchungstag der Bank ist ein Kalendertag und wird unverändert als BankDate übernommen; keine Umrechnung über Zeitzonen, kein Setzen auf „Importzeitpunkt“. Der Monat folgt daraus. Importzeitpunkte sind Instants und getrennt zu speichern. Ungültige oder nicht kanonische Quellwerte ablehnen oder dem Nutzer melden, nicht still reparieren (`bankDateFromCarrier`, `monthKeyFromAnchor` lehnen sie ab).

**Alle:** neue Daten- und Monatsfelder brauchen ein Contract-Schema aus `calendar.ts`, einen Integrationstest in mindestens zwei Server-Zonen und einen Browsertest in mindestens zwei Browser-Zonen, ohne gemockte Formatter; Frontend-Tests nur an konkreten Antworten synchronisieren.

## D-02 / DEC-0041, DEC-0042, DEC-0051: Kontozone

Fachlich beschlossen, **technisch nicht umgesetzt**: IANA-Zone pro Account (Default `Europe/Berlin`, Wahl beim Anlegen, nur der Owner ändert, nur zukünftig), geplanter Wechsel wirksam am späteren der beiden lokalen Monatsanfänge (`effectiveAtUTC = MAX(oldStartUTC, newStartUTC)`), erneute Wahl überschreibt eine anstehende Änderung, Wahl der bereits aktiven Zone entfernt sie. Im Code gibt es kein `timeZone` an Account, Contract oder Migration; `currentMonthKey(zone, now)` ist nur die vorbereitete reine Funktion.

Der Rollout ist ein **eigener technischer Schritt** (Plan P04 und TZ-01–15) mit additivem Account-Feld und Contract, einer **separat freigegebenen** Migration für Altkonten (kein stilles Umhängen bestehender Konten), Activity-Ereignis je tatsächlicher Änderung, Konkurrenz-/CAS-Tests gegen Ensure und Zonenwechsel sowie UI. H01–H07 führen ihn nicht ein. Folge bis dahin (bekannt, kein Fehler): bei einer Browserzone vor UTC (z. B. Berlin, 31.10. 23:30Z) zeigt die Monatsansicht noch den UTC-Monat, während der Drawer den lokalen Tag bucht (CAL-23, im Test festgeschrieben). Das wird erst mit der Kontozone aufgelöst.

## Rollout und Backout

Die Änderungen H01–H06 sind Code und Tests ohne Schemaänderung, Migration oder Datenumschreibung (H05: Audit nur lesend). Es gibt keine Automatik für Produktion.

- **Rollout:** regulärer Build/Deploy der Anwendung nach den bestehenden Gates (`quality:full`, Artefakt-Test) und ausdrücklicher Freigabe des Eigentümers. Vorher einmal `audit-calendar` read-only gegen die eigene Datenbank ausführen (Aufruf in [development.md](../development.md)); bei `REVIEW` oder `STOP-DATA` nicht ausrollen, sondern gesondert entscheiden. Dieser Befund liegt für Echtdaten noch nicht vor.
- **Backout:** vorheriges Artefakt/Commit wieder einsetzen. Weil nichts migriert wurde, bleiben die Daten gültig; vom neuen Code geschriebene Werte (Monatsanker, UTC-Mitternacht-Träger) sind für den alten Code lesbar. Ein Backout verlangt kein Restore und darf keines auslösen.
- **Nicht Teil dieses Rollouts:** Kontozone, ACL der Kalender-Routen (AUTH-001/002, P02), Datenbereinigung, Recurrence-Funktionen.

## Fundstellen A01–A36 und W01–W26

Status: **DONE** (umgesetzt und durch Test belegt), **NOT-APPLICABLE** (kein Änderungsbedarf oder inaktiv, mit Grund), **SEPARATE-TICKET** (bewusst nicht in H01–H06, mit Grund). Testkürzel: CT `packages/contracts/tests/calendar.test.mjs`, UM `apps/api/tests/unit/month-helpers.test.mjs`, UT `apps/api/tests/unit/transaction-dates.test.mjs`, TD `apps/api/tests/integration/transaction-dates.test.mjs`, MI `apps/api/tests/integration/month-intervals.test.mjs`, CA `apps/api/tests/integration/calendar-audit.test.mjs`, XZ `apps/web/tests/e2e/calendar-cross-zone.spec.ts`, FL `calendar-flows.spec.ts`, RQ `calendar-qa.real.spec.ts`, RL `calendar.real.spec.ts`, PK `apps/web/src/app/shared/utils/calendar-picker.spec.ts`. Der Status entspricht dem Stand von `develop` bei Erstellung (Code `b3ead17`); er beruht auf Code- und Testsichtung, nicht auf einer erneuten Einzelverifikation jeder Zeile.

### API / Contracts

| ID | Status | Nachweis oder Grund |
| --- | --- | --- |
| A01 | DONE | `Month` in `common.ts` ist `MonthKeySchema` aus `calendar.ts`; CT (CAL-01/03, „one definition“) |
| A02 | DONE | `accounts.ts` re-exportiert dasselbe `Month`; CT |
| A03 | DONE | Ableitung über `monthKeyOfUtcDate`/`calendar.ts`; Widerspruch 422 ohne Write; UT, TD (CAL-10–13). `bookDate` akzeptiert weiter jeden ISO-Zeitpunkt (Kompatibilität; UTC-Monat des Werts) |
| A04 | DONE | `month: Month`, ISO-Anker in der Antwort; MI (CAL-14) |
| A05 | DONE | wie A04; MI (CAL-14) |
| A06 | NOT-APPLICABLE | `activeFrom` ist `Month`; `nextPlanned`/`lastEmitted` bleiben Instants. Keine neue Vorkommenslogik laut Plan; Legacy-Route siehe A17 |
| A07 | DONE | `MonthInputSchema.nullish()`, null/undefined getrennt; CT, MI (CAL-15–17) |
| A08 | DONE | wie A07 |
| A09 | DONE | wie A07 |
| A10 | DONE | Ressourcenantworten bleiben ISO-Anker (bewusst, nicht auf `YYYY-MM` gebrochen); dokumentiert in contracts.md, MI |
| A11 | SEPARATE-TICKET | `ApiMonthView.monthIso`, `categoryHistory.month` und `currentMonth` sind weiter `z.string()`; Semantik (YYYY-MM vs Anker) ist in contracts.md dokumentiert und per MI getestet, aber nicht im Schema typisiert. Schärfen verlangt eine Vertragsentscheidung |
| A12 | SEPARATE-TICKET | `planning.ts`-Antwortfelder (`fromMonth`, `toMonth`, `month`) bleiben `z.string()`; Query nutzt `Month`. Wie A11 |
| A13 | DONE | OpenAPI/Inventar generiert, `check:contracts` (50 Routen) in `quality:full` |
| A14 | DONE | Modell unverändert (kein Schema-Umbau); Ableitung zentral in der Route; TD (Split-Invarianten) |
| A15 | NOT-APPLICABLE | Modelle und Indizes unverändert; MI (CAL-14: ein Datensatz je Monat) |
| A16 | NOT-APPLICABLE | Modelle unverändert, Altdaten nicht umgeschrieben (CA: tolerierte Altwerte nur gemeldet); Routen siehe A22/A23 |
| A17 | SEPARATE-TICKET | Legacy-Recurrence-Modell/-Route unverändert (`activeFrom` ohne Eingabe = aktueller Zeitpunkt); Ablösung in P02/D-Phase |
| A18 | DONE | `lib/month.ts` delegiert an `calendar.ts`; UM |
| A19 | DONE | `utils/date.ts` ist Alias derselben Implementierung; UM |
| A20 | DONE | `deriveMonth`, No-op, Cascade, Transaktion; UT, TD (CAL-10–13, Failpoints) |
| A21 | DONE | MI (CAL-14: YYYY-MM ein, ISO aus, Filter inklusiv) |
| A22 | DONE | MI (CAL-15–17, Überlappung) |
| A23 | DONE | MI (CAL-15–17, CAL-18) |
| A24 | DONE | `monthKeyOfUtcDate` statt zonenloser Konvertierung; MI (CAL-19 in UTC/Tokyo/LA) |
| A25 | DONE | halboffene Aktivität über `lib/month.ts`; MI (CAL-18/20) |
| A26 | DONE | UTC-Monat und Snapshot-Monat getrennt typisiert; MI (CAL-21). Additives Kalendermonat-Feld bewusst nicht ergänzt (siehe A11) |
| A27 | DONE | Fallback ohne Snapshot ist der Monatsanker; MI (CAL-21) |
| A28 | DONE | Bereiche halboffen (`$lt range.end`); MI (CAL-18) |
| A29 | DONE | Uhr aus `lib/clock.ts`, halboffene Aktivität, keine Rückwirkung; MI (CAL-20 Generator) |
| A30 | NOT-APPLICABLE | rechnet bereits ausschließlich UTC (`reliableBalance.ts`); durch MI (CAL-21) mittelbar abgedeckt, nicht geändert |
| A31 | DONE | inklusive Spannen, offene Enden; UM (A31) |
| A32 | DONE | Aktionslinks mit `YYYY-MM`; MI (CAL-26) |
| A33 | NOT-APPLICABLE | Demo-Seed bleibt unverändert (Monat aus UTC-Datum, UTC-Daten); CA belegt keinen Befund auf Fresh+Seed; kein Neu-Seeden |
| A34 | NOT-APPLICABLE | Baseline `2026-10-v1.json` unverändert (einziger Commit `c24a25b`); keine Migration |
| A35 | NOT-APPLICABLE | Validierungsmiddleware nicht geändert. Schemafehler `400 VALIDATION_ERROR`, fachliche Datumskonflikte `422` mit festen Codes; getestet in MI (ungültige Filter 400) und TD. Eine Gesamtprüfung aller Fehlerantworten auf Datenfreiheit ist nicht Teil von H01–H06 |
| A36 | SEPARATE-TICKET | Kein `Account.timeZone`; Kontozone fachlich beschlossen, technischer Rollout getrennt (siehe oben) |

### Frontend

| ID | Status | Nachweis oder Grund |
| --- | --- | --- |
| W01 | DONE | Monatsansicht startet mit dem UTC-Monat; XZ, RQ (CAL-08/23) |
| W02 | DONE | Anzeige über `formatBankDate`/`formatMonthValue`; PK, XZ (Monatsnavigation) |
| W03 | DONE | MonthKey in State/Service/UI-Modell; XZ, RQ |
| W04 | DONE | Drawer sendet Träger, kein `month`; FL, RQ (CAL-24). Ein echter Mausklick auf „Speichern“ ist nicht belegt (PrimeNG-Maske fängt Automationsklicks, Test per `requestSubmit`) |
| W05 | DONE | `todayBankDate` aus lokalen Kalenderteilen; PK (nur eine Browserzone) |
| W06 | DONE | Dock-Split sendet das Parent-`bookDate` unverändert; FL. Dock-Create ohne eigenen Test; pending Parent ohne `bookDate` bleibt Altverhalten (Server lehnt ab) |
| W07 | DONE | Detail-Editor ohne Phantom-Diff und ohne PATCH beim Öffnen; XZ, RQ (CAL-25) |
| W08 | DONE | Picker zeigt das Fachdatum, keinen Timestamp; PK, XZ (Detail-Editor); Dock-Template ohne eigenen Test |
| W09 | DONE | Toolbar-Monatsfilter über den Adapter; PK. Kein eigener Browsertest über mehrere Zonen |
| W10 | DONE | Liste zeigt BankDate ohne Verschiebung; XZ, RQ |
| W11 | DONE | Filtermonat/DTO, Parent-Kind-Updates; XZ, RQ, Mock-E2E `transactions-page` |
| W12 | DONE | Planung startet mit UTC-Monat, gleicher Wert wie Monatsansicht; FL (CAL-23) |
| W13 | DONE | Editor sendet MonthKey, `toMonth: null` beim Löschen; FL |
| W14 | DONE | wie W13 |
| W15 | DONE | wie W13 |
| W16 | NOT-APPLICABLE | Request-/Modelltypen bereits konform, keine Änderung nötig (H04) |
| W17 | DONE | Wizard-Monatswerte aus dem Adapter; FL (CAL-22, gemockt in 4 Zonen, nicht gegen echte API) |
| W18 | DONE | Monatslabel aus Monatsschlüssel, nicht aus lokalem `Date`; XZ |
| W19 | DONE | Overview-Datenservice/-Modell mit `formatMonthValue`; Timeline-Datum bleibt Instant (lokale Anzeige zulässig), XZ, `calendar-instants.spec.ts` (CAL-09) |
| W20 | DONE | Vertragskommentar korrigiert (API liefert den Anker); Anzeige über `formatMonthValue` |
| W21 | NOT-APPLICABLE | `AccountDashboardStatistikService` ist an keiner Stelle eingebunden (nur die Definition); als Legacy nicht migriert |
| W22 | DONE | Drawer sendet keinen `month` mehr, zeigt Fehler über `saveError`; XZ. Kein eigener Test für den 400/409-Pfad |
| W23 | NOT-APPLICABLE | Bestehende Typen/Contracts genügen; keine parallelen DTOs angelegt. Typschärfe siehe A11 |
| W24 | NOT-APPLICABLE | Stammdaten-Seite enthält keine Datums-/Monatslogik |
| W25 | NOT-APPLICABLE | `/calculation` liest statische Demo-Dateien (`/test/…`), keine Finanz-API, kein persistiertes Datum; enthält zonenlose Luxon-Aufrufe. Bei Produktivierung eigenes Ticket |
| W26 | DONE | Mock-`currentMonth` als Anker wie die echte API; der Mock-Guard lehnt unmockte Aufrufe ab |

## Bekannte Restpunkte (nicht verschwiegen)

- Kalender-Routen prüfen keine Account-Mitgliedschaft (AUTH-001/002; CAL-28 ACL-Teil BLOCKED, Entscheidung 404 und Altkonten blockieren, Umsetzung in P02, offen ob P02 diese Routen abdeckt).
- Echte Nutzerdaten sind nicht auditiert (H05). Kein Aufräum-/Zuordnungsweg für geblockte Altkonten.
- Nicht abgedeckt: DST-Frühling, Dock-Create und echter Klick im Drawer, Planungs-UI gegen die echte API, CAL-21 mit Snapshot im Browser, CAL-22 gegen echte API.
- Planungsseite, Drawer und Monatsansicht können bei Browserzone vor UTC über Monatsgrenzen auseinanderlaufen (siehe oben).
- CI-Ergebnisse der PRs #8–#12 wurden nicht eingesehen.
