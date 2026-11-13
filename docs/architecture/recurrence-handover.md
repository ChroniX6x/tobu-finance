# Recurrence-Handover (H09): Schnittstellen und Readiness

**Aktueller signierter Nachtrag E09 (13.11.2026): A-E09 PASS / Q-E09 PASS.** [Release-/Pre-Recurrence-Bericht mit A/Q, SHA, Unterschriften und Belegen](../agents/runs/E09.md) ist der aktuelle Einstieg. E00–E09-Plattform-A/Q sind PASS; F-3 ist mit echten vierzonigen Zahlungs-/Eventproben geschlossen. Vollständiges frisches17/17Gate auf clean `27c21d4`,180/180Integration/30/30Realbrowser und zusätzlicher echter Tools-/KnownTrigger-/API-Neustart-Restore unabhängig abschließend bestätigt. Der ursprüngliche H09-Lauf ist historisch; operative Tabellen und Anker unten wurden auf den belegten E09-Stand aktualisiert. Recurrence-Domain-/HTTP-/Ensure-/FullDelete-EIT25–30, P01/P02 und technischer Account-Zonen-Rollout P04/EIT35/TZ bleiben eigenständige Folgegates. Kein Recurrence-Coding-, Push-/Merge-/Deploy- oder Bestandsmigrations-GO. **STOP nach E09.**

Ursprünglicher H09-Stand: Repository-HEAD `781c290`,03.11.2026; operative Tabellen/Anker unten aktualisiert nach E09 auf27c21d4, Dokumentationsabschluss41a1558. Reine Dokumentation und Verweissammlung: referenziert die tatsächliche E09-Abnahme, führt selbst keine neuen Tests aus und erteilt kein Recurrence-Coding-/Account-Zonen-GO. Quellen: Date/Month-Plan H09 und §§11–19, Eventplan E09 und §§9, 22–24, Buchungsvorlagenplan D04, D05, V14, §§57.2, 59–61 (lokaler Quellenordner, Hashes in [source-index.md](../agents/source-index.md)).

## Abhängigkeit

Der Recurrence-Plan (D04/D05/D07, V08–V28, P04) ist von folgenden Gates abhängig. Ohne alle fünf beginnt keine Recurrence-Featureimplementierung:

| # | Voraussetzung | Stand |
| --- | --- | --- |
| 1 | H08 A/Q | PASS mit ausdrücklich freigegebenen Ausnahmen; F3 geschlossen. [Verbindliche Folgepflichten](../agents/date-event-followups.md) bleiben ihrem Folgeschritt zugeordnet. |
| 2 | Eventplattform E00–E09 A/Q | **PASS**, unabhängiger Review,17/17Gruppen; [E09](../agents/runs/E09.md). |
| 3 | Account-Zonen-Rollout (P04, TZ-01–15, EIT-35) | **nicht umgesetzt**; fachlich beschlossen (DEC-0041/0042/0051) |
| 4 | Gemeinsamer Integrations-SHA aus H08 und E09 | **belegt:27c21d40fd4a79f1758e087b27b54cf54d066402**, clean Fresh-Gate; spätere reine Dokumentationsänderungen ändern keine Gatequellen. |
| 5 | Separate Recurrence-Coding-Freigabe | nicht erteilt; DEC-0055 gilt nur bedingt unter 1–4 |

P03 (Architektur/Spezifikation) ist durch DEC-0052 bestätigt; das ist keine Code-, Schema- oder Migrationsfreigabe.

## Kalenderbibliothek und DTO-Semantik (von H08 geliefert, unveränderlich)

Verbindlich für alle Recurrence-/Occurrence-/Book-/Link-/History-/P04-DTOs (DEC-0056, Vorlagenplan §59). Begründung und Pflichten: [date-month-semantics.md](date-month-semantics.md), Referenz der Helfer: [contracts.md](contracts.md).

| Begriff | Format | Code-Quelle |
| --- | --- | --- |
| MonthKey (Befehle/Queries) | `YYYY-MM` | `MonthKeySchema`, `MonthInputSchema`, `normalizeMonthInput` |
| Monatsanker (Mongo/Ressourcen) | `YYYY-MM-01T00:00:00.000Z` | `monthKeyToAnchor(Iso)`, `monthKeyFromAnchor`, `CanonicalUtcMonthAnchorSchema` |
| BankDate (JSON und BSON) | `YYYY-MM-DDT00:00:00.000Z`, Kalendertag, kein Instant | `BankDateCarrierSchema`, `bankDateToCarrier`, `bankDateFromCarrier`, `monthKeyFromBankDate(Carrier)` |
| Instant (`occurredAt`, `createdAt`) | ISO-UTC mit realer Uhrzeit | nie Träger; Anzeige über `formatInstant` im Web |
| Account-Current | MonthKey aus gültiger Zone und vertrauenswürdiger Serveruhr | `currentMonthKey(zone, now)`; bis P04 gilt UTC |

Alle Helfer liegen in [calendar.ts](../../packages/contracts/src/calendar.ts) (`@tobu/contracts/calendar`), API-Adapter [month.ts](../../apps/api/src/lib/month.ts) und Uhr [clock.ts](../../apps/api/src/lib/clock.ts), Web-Adapter [calendar-picker.ts](../../apps/web/src/app/shared/utils/calendar-picker.ts). Luxon gepinnt, immer mit expliziter Zone; keine zweite Bibliothek, kein zweites öffentliches `YYYY-MM-DD`-BankDate-Format (STOP/Contract-Verstoß). Ein optionaler Occurrence-Tag 1–31 ist nur Anzeige, nie BankDate oder Instant.

## Anker je Schritt

| Schritt | Verweis | Was aus H08 gilt |
| --- | --- | --- |
| D04 Rhythmusrechner | Vorlagenplan „D04 — REINER RHYTHMUSRECHNER“; `occurrenceKey` = MonthKey `YYYY-MM` | Reine Funktion auf MonthKey (`addMonthsToMonthKey`), keine UI-/Browserzone, keine DB; Preview schreibt weder Buchungen noch Activity |
| D05 Schema/Migration | Vorlagenplan „D05“, [migration-authoring.md](../database/migration-authoring.md), [structural-migrations.md](../database/structural-migrations.md) | Monatsfelder als Anker, BankDates als Träger; Baseline `2026-10-v1.json` bleibt unverändert, Expand→Migrate→Contract, E03-Migration ist eigene Voraussetzung. Die Legacy-Collection `recurrences` ([Recurrence.ts](../../apps/api/src/models/Recurrence.ts), [recurrences.ts](../../apps/api/src/routes/recurrences.ts)) ist keine Vorlage |
| V14 Buchen | Vorlagenplan „V14“ | Buchen über die bestehende Transactions-Route: Monat folgt dem BankDate (`422 MONTH_BOOKDATE_MISMATCH` sonst), `occurrenceKey` bleibt der geplante Monat; Splits/Saldo wie CAL-Tests; Activity nur vom Transaction-Writer, kein `recurrence.booked` |

## Event- und Finance-Anker

- **Finanzwahrheit:** Transaction/Parent/Child/Status und BankDate; `RecurrenceRevision` ist Konfigurationssnapshot; Activity beschreibt nur die Ausführung (Eventplan §5.3). Keine Finanzmonate aus Eventzeit berechnen.
- **`occurredAt`:** echter UTC-Instant, bestehende Event-Collection mit persistiertem `date`, API-Projektion `occurredAt` (Eventplan §22.2); nie Midnight-Träger, nie MonthKey.
- **Aktueller Plattformstand:** [Event.ts](../../apps/api/src/models/Event.ts) unterstützt verifizierte Actor/Trigger/Subject und schemaVersion; gemeinsamer atomarer Writer, sichere Activity-GET-/20erVorschau,44Codes und Desktop/Mobile/AX sind E00–E09 abgenommen. Historische Events bleiben Legacy-Unknown; kein neuer Recurrence-Ensure-Service oder Domain-/Zonencommand. [Writer](activity-writer.md), [Read](activity-read.md), [E09](../agents/runs/E09.md).
- **Bereits belegte Plattformgarantien:** Fachmutation/Events atomar, keine Events bei GET/No-op/Rollback, sichere Retry-/Readback-/Restart-/CommitUnknown-Fälle und generische Delete/Eventerhalt-Proben. **Spätere Domainpflichten:** tatsächliche Recurrence-Ensure-/Revision-/FullDelete-EIT25–30 in V08–V28; Konto-Zonenänderung samt Activity in P04/EIT35. Keine Gleichsetzung generischer Fixtures mit implementierter Domain.

## Kontozone

Beschlossen, nicht implementiert: im Code gibt es kein `timeZone` an Account, Contract oder Migration. Der Rollout (P04, TZ-01–15) braucht Account-Feld, separat freigegebene Altkonten-Migration, Account-CAS gegen Ensure, Activity und UI. H08 nutzt bis dahin UTC als kontrollierten gemeinsamen Current-Month; Event-Instant und BankDate/MonthKey bleiben getrennt. Bankanbindungsadapter sind ein separates späteres Feature.

## Geschlossene und offene Übergabepunkte aus H08

Verbindlich vor dem jeweiligen Folgeschritt zu schließen: [zentrale Folgepflichten](../agents/date-event-followups.md), insbesondere EX07/A17 vor Legacy-Nutzung/P02, F5/F7/F8-/AUTH-/API-Restpakete vor P02, F6/P04 sowie F1/Bestandskorrektur nur nach eigener Freigabe. F3, Wizard-Navigation und Owner-Self-/Category-Create im E05-Umfang sind umgesetzt und geprüft; keine erneute offene Fachentscheidung daraus ableiten.

## Grenzen

Dieser Handover startet weder V08 (UI) noch D07 (Ensure), erzeugt keine Migration, ändert keine Daten und keinen Code. Gesperrt bleiben Push, Merge, Deploy und jede Prod-/Bestandsmigration ohne ausdrückliche Freigabe.
