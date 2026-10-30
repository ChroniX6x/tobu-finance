# Gemeinsame HTTP-Verträge

`packages/contracts` ist die gepflegte Quelle für Requests und serialisierte Responses. Das private npm-Paket `@tobu/contracts` enthält ausschließlich TypeScript/Zod, keine Angular-, Express-, Mongoose- oder Datenbankmodule. Zod bleibt auf der bereits verwendeten Version 4.1.12. Die bisherigen API-Validierungsdateien und Frontend-Transportdateien sind überwiegend Kompatibilitäts-Reexports; UI- und Datenbankmodelle bleiben in ihren Anwendungen.

## Nutzung und Build

```ts
import { CreateTx } from '@tobu/contracts/transactions';
import type { CreateTransactionDto, ValidatedCreateTransaction } from '@tobu/contracts/transactions';
```

`CreateTransactionDto` beschreibt `z.input`: beispielsweise darf der Client `status` weglassen. `ValidatedCreateTransaction` beschreibt `z.output`: nach dem Parse ist `status` gesetzt. PATCH bleibt ein Teilrequest; Regeln zum resultierenden Gesamtzustand und referenzierte Daten prüft die API. Response-Schemas prüfen JSON mit String-IDs und ISO-Zeitstempeln, keine `Date`- oder `ObjectId`-Instanzen.

`npm run build:contracts` erzeugt ESM-JavaScript und Typdeklarationen in `packages/contracts/dist`. API- und Web-Build/Typecheck bauen das Paket vorher. Auch die separaten App-Startbefehle bauen es zuerst. `npm run dev` baut es vor dem Start und überwacht es zusätzlich mit dem TypeScript-Watcher. Beim Verteilen der gebauten API gehört das gebaute Vertragspaket zu ihren Laufzeitabhängigkeiten; ein bloßer TS-Pfadalias würde nicht genügen.

## Endpunktgruppen und Verbraucher

| Gruppe | Verbraucher im Web | Gemeinsame Quelle |
| --- | --- | --- |
| Buchungen und Splits | TransactionsApiService, Detailformular, Capture-State, Mock-E2E | transactions.ts |
| Konten/Mitglieder/Kategorien | Datenservices, Wizard, Stammdatenservice | accounts.ts, members.ts, categories.ts, resources.ts |
| Budgets/Einkommen/Beitragsregeln | PlanningApiService, Wizard | category-budgets.ts, member-incomes.ts, contribution-rules.ts |
| Salden/Überträge/Wiederkehrer | Wizard bzw. API; kein eigener aktiver Web-CRUD für alle Ressourcen | account-balances.ts, carryovers.ts, recurrences.ts, resources.ts |
| Monatsansicht/Kontoübersicht/Kontoliste | View-Datenservices | views.ts |
| Stammdaten/Planung | MasterDataApiService, PlanningApiService | master-data.ts, planning.ts, read-queries.ts |
| Auth | AuthService, Login/Registrierung, Sessiontests | auth.ts |

Das vollständige [Endpunktinventar](api-endpoints.md) enthält Methode, Pfad, Authentifizierung, Request-/Query-Schema und Erfolgsstatus aller 50 implementierten HTTP-Endpunkte unter `/api`. Health/Readiness und Swagger sind Infrastrukturendpunkte außerhalb dieses Inventars. Weitere externe API-Verbraucher sind nach Nutzerangabe nicht vorhanden.

Die API gibt teilweise zusätzliche Metadaten wie `createdAt`, `updatedAt` oder `__v` aus. Die Vertragsprüfung akzeptiert sie, verändert oder entfernt sie aber nicht. UI-Modelle werden explizit aus den Transportdaten abgeleitet, etwa `_id` zu `id` und nullable Namen zu Platzhaltern. Zusammengesetzte Formtypen, etwa Mitgliedsdaten plus Kontorolle, bleiben im Web und werden auf getrennte HTTP-Requests abgebildet.

## Datum und Monat (`calendar.ts`)

[`packages/contracts/src/calendar.ts`](../../packages/contracts/src/calendar.ts) ist die einzige Quelle für Kalenderregeln; die Bibliothek ist rein und frameworkfrei. Wer Monate, Buchungstage oder „aktuellen Monat“ braucht, importiert von dort (`@tobu/contracts/calendar`), keine zweite Regex und kein eigener Parser.

**Luxon überall, auch in `calendar.ts`:** `apps/api`, `apps/web` und `packages/contracts/src/calendar.ts` verwenden für Datums- und Zeitlogik (Arithmetik, Parsen, Formatieren, Anzeige) Luxon (`DateTime`, in allen drei `package.json` auf dieselbe Version gepinnt), immer mit expliziter Zone, z. B. `DateTime.utc(...)`, `DateTime.fromISO(x, { zone: 'utc' })` oder `DateTime.fromJSDate(d, { zone })`. Die Nutzer- oder Kontozone gilt nur für die Anzeige echter Zeitpunkte und für `currentMonthKey`. Nicht zulässig sind `DateTime.fromJSDate(d)`/`DateTime.now()` ohne Zone, lokales `new Date(y, m, d)`, `getMonth()`/`getDate()` und `toLocale*` zur Ableitung fachlicher Monate oder Buchungstage sowie eine zweite Datumsbibliothek. Außerhalb von `calendar.ts` bleiben die Contract-Dateien zod-only; `npm run check:contracts` erlaubt Luxon nur dort und nur in der Version der Apps. Neue Abhängigkeiten im Contracts-Paket brauchen Freigabe. Bestehende Stellen, die diese Regeln verletzen, werden in den Plan-Schritten H02–H04 umgestellt, nicht nebenbei.

| Begriff | Format | Verwendung |
| --- | --- | --- |
| `MonthKey` | `YYYY-MM` | Fachlicher Monat für Befehle, Queries und Planning/MonthView-ReadModels. Strenge Kalenderprüfung, Jahr 1000–9999. |
| Monatsanker | `YYYY-MM-01T00:00:00.000Z` | Persistierter BSON-Monat und ISO-Form in bestehenden Ressourcenantworten (`resources.ts`). Diese Antworten werden nicht auf `YYYY-MM` umgestellt. |
| `MonthInput` | `YYYY-MM` oder exakter Monatsanker | Übergangsinput für `fromMonth`/`toMonth` von Einkommen, Budgets und Beitragsregeln. Andere Tage, Uhrzeiten oder Offsets werden abgelehnt; `normalizeMonthInput` liefert sofort den `MonthKey`. Das Schema selbst gibt den Originalstring zurück; die Routen normalisieren erst mit H03 (bis dahin parst `toMonthDate` beide Formen UTC-fest). |
| `BankDate` | `YYYY-MM-DD` | Buchungstag der Bank als Kalendertag. Träger in JSON/BSON ist `YYYY-MM-DDT00:00:00.000Z`; er ist kein Zeitpunkt und wird nie lokalisiert. Der Buchungsmonat folgt dem Kalendertag unabhängig von Zeitzonen. |
| Instant | ISO-UTC | Echte Zeitpunkte wie Ereignisse und `createdAt`. Für sie niemals die BankDate-Helfer verwenden. |

`currentMonthKey(zone, now)` berechnet den aktuellen Monat aus einer IANA-Zone und einem vertrauenswürdigen Zeitpunkt (DST-sicher, keine festen Offsets, `+01:00` wird abgelehnt). Das Account-Zonen-Feature selbst ist damit noch nicht eingeführt (D-02/P04). Ungültige oder nicht kanonische Altwerte werden nie stillschweigend korrigiert: `monthKeyFromAnchor` und `bankDateFromCarrier` lehnen sie ab.

## OpenAPI und Fehlererkennung

`npm run contracts:generate` erzeugt OpenAPI 3.1 und das Inventar aus `endpoints.ts` mit dem eingebauten Zod-4-JSON-Schema-Export. Es ist kein zusätzliches Generierungspaket nötig. `npm run check:contracts` erkennt veraltete generierte Dateien, nicht dokumentierte oder entfernte API-Routen und Serverabhängigkeiten im Vertragspaket.

Zod-Refinements, beispielsweise Summenregeln und feldübergreifende Bedingungen, lassen sich nicht vollständig als JSON Schema ausdrücken. Die OpenAPI-Beschreibung nennt diese Grenzen; die ausführbaren Schemas und Vertrags-/Integrationstests sind dafür verbindlich. Querywerte kommen als Strings an; das Inventar dokumentiert die nach Normalisierung geprüften Werte und Defaults. `categoryIds[]` wird vor der Validierung normalisiert, damit ungültige IDs nicht an der Prüfung vorbeigelangen.

Fehlerantworten bleiben kompatibel: `{error: ...}`, teilweise `{code, message}` und `text/plain` bei einzelnen 404-Antworten. Kein einheitliches neues Fehlerformat wird heimlich eingeführt. Manche ältere Ressourcenlisten ignorieren ungültige String-ID-Filter weiterhin; diese Bestandssemantik wird nicht zu einer neuen Berechtigungsregel erklärt.

Im Testmodus (`NODE_ENV=test`) prüft die API die tatsächliche JSON-Serialisierung. Optional gilt das auch mit `TOBU_VALIDATE_RESPONSES=1`. Playwright prüft erfolgreiche API-Antworten und deren Request-Bodies, einschließlich der Mock-Antworten. Für Real-API-Integration werden Antworten außerdem clientseitig geprüft. Unerwartete Proxyrequests sind separat als [TEST-001](../migration/open-issues.md) erfasst.

`npm run test:contracts` enthält positive/negative Laufzeittests, eine absichtlich inkompatible Schemaänderung und TypeScript-Negativfälle (`@ts-expect-error`). Eine falsche Geldtypisierung, ein `Date` im JSON-Typ oder ein unzulässiger Patch muss damit auffallen. Autorisierung und DB-abhängige Splitregeln bleiben Aufgabe der API; gemeinsame Schemas verleihen keine Rechte.
