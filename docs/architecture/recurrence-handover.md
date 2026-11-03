# Recurrence-Handover (H09): Schnittstellen und Readiness

Stand: Repository-HEAD `781c290` (nach H08), 03.11.2026. Reine Dokumentation und Verweissammlung, **kein** Recurrence-Coding-GO, keine Abnahme von E00–E09 oder des Account-Zonen-Rollouts. Quellen: Date/Month-Plan H09 und §§11–19, Eventplan E09 und §§9, 22–24, Buchungsvorlagenplan D04, D05, V14, §§57.2, 59–61 (lokaler Quellenordner, Hashes in [source-index.md](../agents/source-index.md)).

## Abhängigkeit

Der Recurrence-Plan (D04/D05/D07, V08–V28, P04) ist von folgenden Gates abhängig. Ohne alle fünf beginnt keine Recurrence-Featureimplementierung:

| # | Voraussetzung | Stand |
| --- | --- | --- |
| 1 | H08 A/Q | PASS mit ausdrücklich freigegebenen Ausnahmen ([H08-ABSCHLUSS](../agents/runs/H08-ABSCHLUSS.md), [Ausnahmen](../agents/h08-freigegebene-ausnahmen.md)); EX-07/A17 und F-3/F-5–F-8 sind je dem späteren Schritt zugeordnet |
| 2 | Eventplattform E00–E09 A/Q | **nicht umgesetzt** (kein Bericht, siehe unten) |
| 3 | Account-Zonen-Rollout (P04, TZ-01–15, EIT-35) | **nicht umgesetzt**; fachlich beschlossen (DEC-0041/0042/0051) |
| 4 | Gemeinsamer Integrations-SHA aus H08 und E09 (Plan §60.4) | nicht vorhanden |
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
- **Iststand Events (HEAD):** [Event.ts](../../apps/api/src/models/Event.ts) hat nur `accountId`, `date`, `code`, `params`, `createdByMemberId`, `timestamps`. Es gibt keinen Actor/Trigger/Subject, keine `schemaVersion`, keinen zentralen Writer und keine Route `GET /api/accounts/:accountId/activity`. 15 direkte `Event.create`-Aufrufe in `transactions` (4), `accounts` (2), `contribution-rules` (3), `member-incomes` (3), `category-budgets` (3) laufen außerhalb eines gemeinsamen Writers. Das ist der Stand vor E00; er ist keine Plattform.
- **Pflichten laut Plan für später (nicht umgesetzt):** Fachmutation und Events in einer Mongo-Transaktion; kein Event bei GET, No-op, Fehler oder Rollback; Retry über commandId/Readback; nach zulässigem FullDelete bleiben Events erhalten, genau ein atomarer `recurrence.deleted` (DEC-0050); Config-Revision nur bei echten Edits, Statuswechsel als Activity (DEC-0040); Zonenänderung als Activity genau einmal (DEC-0042/0051).

## Kontozone

Beschlossen, nicht implementiert: im Code gibt es kein `timeZone` an Account, Contract oder Migration. Der Rollout (P04, TZ-01–15) braucht Account-Feld, separat freigegebene Altkonten-Migration, Account-CAS gegen Ensure, Activity und UI. H08 nutzt bis dahin UTC als kontrollierten gemeinsamen Current-Month; Event-Instant und BankDate/MonthKey bleiben getrennt. Bankanbindungsadapter sind ein separates späteres Feature.

## Geschlossene und offene Übergabepunkte aus H08

Vor dem jeweiligen Schritt zu schließen (Details in [h08-freigegebene-ausnahmen.md](../agents/h08-freigegebene-ausnahmen.md)): EX-07/A17 (`activeFrom` fällt bei fehlendem Wert auf `new Date()` statt Monatsanker, vor jeder Nutzung des Legacy-Moduls, P02), F-5/F-7/F-8 (P02/AUTH-001), F-3 (UI-Fix vor E09), F-6 (P04), F-1 (Bestandskorrektur nur nach eigener Freigabe). §61.3/§61.4 (Owner-Self-Member, Category-Create) sind entschieden, ihre Umsetzung steht aus.

## Grenzen

Dieser Handover startet weder V08 (UI) noch D07 (Ensure), erzeugt keine Migration, ändert keine Daten und keinen Code. Gesperrt bleiben Push, Merge, Deploy und jede Prod-/Bestandsmigration ohne ausdrückliche Freigabe.
