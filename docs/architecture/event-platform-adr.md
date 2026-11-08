# ADR: Event-/Activity-Plattform (E01)

**Umsetzungsnachtrag E07:**44 explizite Eventcodes,12 neue Primitiven mit recurrence/occurrence Subjects und minimalen Revision-/Slotreferenzen. [Aktueller Vertrag](recurrence-activity-primitives.md). Der folgende E01-Text ist historischer Entscheidungsstand; E07 ist keine neue Recurrence-Domain, Ensure- oder Konto-Zonenimplementierung.

**Umsetzungsnachtrag E06,08.11.2026:** Der folgende Text hält den E01-Entscheidungsstand fest. E05 hat den Katalog auf32Codes erweitert; E06 implementiert nun den autorisierten GET, die identisch geschützte20er-Vorschau und die Desktop-/Mobile-Ansicht. Aktueller [Read-/Cursor-/Privacyvertrag](activity-read.md) und [A/Q-Bericht E06](../agents/runs/E06.md). Keine Recurrence-Engine oder pauschale Schließung der unten genannten Folgegates.

Stand: 04.11.2026, Schritt E01 (Eventplan Kapitel 6 E01, §§22–24, Buchungsvorlagenplan §61). Dieses Dokument legt den **Vertrag** fest. Es führt keinen Writer, keine Route, keine Persistenzänderung und keine Migration ein; die Umsetzung folgt in E02–E07. Quelle der ausführbaren Schemas: [activity.ts](../../packages/contracts/src/activity.ts), Tests: [activity.test.mjs](../../packages/contracts/tests/activity.test.mjs). Iststand vor E01: [E00.md](../agents/runs/E00.md).

## Entscheidung

1. **Eine** Event-Collection (`events`, bestehend) und **eine** Contract-Quelle (`@tobu/contracts/activity`). Keine zweite Historie, kein Bus, keine Outbox, keine generische Idempotency-Collection, kein generisches Commandframework.
2. Das persistierte Feld `date` bleibt der einzige Ereigniszeitpunkt (echter UTC-Instant). Die API projiziert es als `occurredAt` (ISO-UTC, `Z`). Weder MonthKey noch BankDate werden daraus abgeleitet, und Fachmonate werden nie aus Eventzeit berechnet (H08, `calendar.ts`).
3. Neue Events tragen `schemaVersion: 1`, serververtrauten `actor`/`trigger`, `subject`, whitelisted `params` und optionale Schlüssel. Es gibt **keinen** Request-Contract, der Events anlegt; Clients senden nie Actor, Trigger, Subject, `accountId` oder Schlüssel für Events (Test: keine Schreib-Route mit „activity/event“ im Endpunktinventar).
4. Alte Events bleiben unverändert in der Datenbank und werden nur beim Lesen projiziert (Decoder). Es gibt keinen Backfill.

## Persistiertes Envelope (neue Events)

| Feld                                    | Regel                                                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accountId`                             | ObjectId, Pflicht, unveränderlich (INV-SCOPE). Referenzierte Entität gehört demselben Konto.                                                                         |
| `date`                                  | BSON Date (UTC-Instant), Pflicht; vom Server gesetzt.                                                                                                                |
| `code`                                  | Eintrag des Katalogs (siehe unten). Reservierte Familien `recurrence.*`, `occurrence.*` gehören E07 und werden vorher abgelehnt.                                     |
| `schemaVersion`                         | `1`. Nicht erkannte Versionen werden beim Lesen als unbekannt behandelt.                                                                                             |
| `actor`                                 | `{kind:'user', userId}` (JWT `sub`, serverseitig geprüft) oder `{kind:'system'}`. `legacy_unknown` ist **nie speicherbar**.                                          |
| `trigger`                               | `user_action` (nur mit user-Actor) oder `account_open` / `automation` / `system_reconciliation` (nur mit system-Actor), optional `initiatedByUserId` nur bei system. |
| `subject`                               | `{kind, id}`: das geänderte Fachobjekt. `kind` ist durch den Code festgelegt; `id` muss dem Code-Parameter (z. B. `transactionId`) bzw. `accountId` entsprechen.     |
| `params`                                | strikt whitelisted pro Code; unbekannte Keys werden abgelehnt.                                                                                                       |
| `commandId`, `correlationId`, `batchId` | optional, 8–64 Zeichen `[A-Za-z0-9._:-]`, **nur server erzeugt** (Regeln unten).                                                                                     |
| `createdByMemberId`                     | Legacy-Spalte. Neue Events setzen sie nicht (fehlt oder `null`); sie ist nie ein Actor.                                                                              |

Verschachtelte IDs (`actor.userId`, `subject.id`, ID-Params) werden als 24-stelliger Hex-String gespeichert, wie die bisherigen Params; `accountId` bleibt ObjectId. Der Decoder akzeptiert beides.

**User vs. Member:** `actor.userId` ist die authentifizierte Benutzer-ID, nie `paidByMemberId`, `createdByMemberId` oder ein Body-Wert. Betroffene Member/Zahler stehen getrennt in `params` (z. B. `memberId`). Das Mapping User→Member zur Anzeige löst der Server beim Lesen auf, ohne den gespeicherten Actor zu verändern; ein nicht registriertes Member ist nie ein Actor.

## Katalog und Payload-Whitelist

31 Codes in `activityCatalog` (Quelle der Wahrheit; Renderer, Schemas und Tests sind per Typ/Test an diese Liste gebunden). Persistierte Param-Namen der 16 bestehenden Codes bleiben unverändert, damit Altevents mit demselben Schema lesbar sind.

| Familie                     | Codes (Subject)                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Transaktion                 | `transaction.created`, `.splitChildCreated`, `.booked`, `.statusChanged`, `.updated`_, `.deleted`_, `.splitChildDeleted` (transaction)      |
| Kategorie                   | `category.created`_, `.updated`_, `.deleted`\* (category)                                                                                   |
| Konto                       | `account.created`_, `account.settings.updated`_ (account); `account.member.added`, `.removed`, `.roleChanged`\* (member)                    |
| Einkommen / Regeln / Budget | `memberIncome.added/updated/removed`, `contributionRule.added/updated/removed`, `categoryBudget.added/updated/removed`                      |
| Überträge / Salden          | `carryOver.set`_, `.removed`_, `accountBalance.set`_, `.removed`_ (Upsert: ein Code `set`, da Anlegen und Ändern nicht unterscheidbar sind) |
| Legacy-Recurrence-CRUD      | `legacyRecurrence.created/updated/deleted`\* (nur bestehende Route; **kein** DEC-0052-Code)                                                 |

\* neu in E01 (§22.3). **`legacyRecurrence.*` ist ausdrücklich ein Übergangsbestandteil (Entscheidung Eigentümer, 04.11.2026):** Die Codes existieren nur, solange die alte Route `/api/recurrences` erreichbar ist und E05 sie anbinden muss (§22.4). Die Route wird vom Web nicht genutzt und soll durch die neue Recurrence-Funktion ersetzt oder gelöscht werden (P02/D-Phase; offener Fehler EX-07). **Aufräumpflicht:** Sobald die Route gelöscht ist, werden die Codes samt Subject-Kind `legacyRecurrence` entfernt (Altevents bleiben dann als `legacy.unknown` lesbar) oder, falls die Route in die neue Funktion übergeht, auf die dann gültigen `recurrence.*`-Codes umbenannt bzw. dort gemappt. Der Name vermeidet nur, den Namensraum `recurrence.*` von E07 vorwegzunehmen.

Whitelist-Regeln: Geld nur als Integer-Minor-Units; Monate nur `YYYY-MM`; Freitext nur `title`/`name` (1–120 bzw. 1–80 Zeichen, reiner Text); **nie** `notes`, `reason`, E-Mail, Token, Einkommens-/Kontaktsnapshots oder Vollobjekte. **Freitext wird geclippt, nie abgelehnt:** Die Eingabe-Contracts sind weiter (z. B. `name` nullish, `title` ohne Grenze); der Writer (E04) muss `clipActivityText` (trim, leer ⇒ weglassen, Kürzung nach Codepoints) verwenden, damit ein überlanger oder leerer Titel nie einen Event-Insert und damit die gültige Fachmutation zurückrollt. Änderungen werden als `changedFields` (+ kleine `from/to`-Deltas für Betrag/Kategorie) beschrieben. Statuswechsel einer Transaktion sind eigene Codes (`booked`/`statusChanged`) und kein `changedFields`-Eintrag; ein PATCH mit Feldänderung **und** Statuswechsel erzeugt beide Events mit derselben `correlationId` (Festlegung für E05).

**Scope ist Writer-Pflicht, nicht Schema:** Ein Schema kann nicht prüfen, dass `subject.id` und ID-Params (`memberId`, `categoryId`, `parentTransactionId`) zum Konto gehören; bei Einkommen, Budgets, Überträgen, Salden und Legacy-Recurrence ist `subject.id` nicht einmal an einen Param gebunden. E04 muss die Kontozugehörigkeit vor dem Insert in derselben Transaktion prüfen; E04/E05 testen Fremdkonto-IDs mit 0 Writes/0 Events (EIT-08, EIT-32).

## Command-, Correlation- und Batch-Regeln

- `correlationId`: pro HTTP-Request/Command vom Writer erzeugt; alle Events einer Fachmutation tragen sie. Der Writer (E04) setzt sie immer; das Schema lässt sie optional (§22.2), die E04-Tests erzwingen sie.
- `commandId`: stabiler Schlüssel eines logischen Commands für Retry-/Readback-Erkennung (E04, §22.5). Er ist **kein** pauschaler Unique-Key über Events: ein Command darf mehrere legitime Events erzeugen, die Eindeutigkeit wird über (Konto, `commandId`, Code, Subject) bewertet, die Index-Entscheidung gehört in E03/E04.
- `batchId`: nur bei vertrauenswürdig gebündelten Mehrfach-Writes (DEC-0048). Die UI gruppiert nur über `batchId`/`correlationId`, nie über Zeitnähe, und behauptet keinen Gesamterfolg über ungeladene Seiten oder bei PartialSuccess.
- Schlüssel kommen nie aus Request-Body oder Header.

## Anzeigeklassen USER / SYSTEM / UNKNOWN

| API-`actor.kind` | Bedeutung                                                                                                       | Anzeige                      |
| ---------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `user`           | echte authentifizierte Person; `memberId`/`displayName` nur, wenn verknüpft und im Konto sichtbar, sonst `null` | Name, ersatzweise „Benutzer“ |
| `system`         | interne Automatik (kein Fake-Login); Trigger und optional Initiator getrennt                                    | „System“ + Trigger-Label     |
| `unknown`        | Altbestand ohne Actor oder nicht auswertbares Event; **nie** als Person oder Automation dargestellt             | „Unbekannt (Altbestand)“     |

Die Read-Projektion enthält keine `userId`, `commandId` und keine Roh-Legacy-Spalten.

## Legacy-Decoder (`decodeStoredEvent`)

Pur, wirft nie, erfindet nie einen Actor.

- Dokument ohne `schemaVersion`: nur die 16 Altcodes werden erkannt. Params werden feldweise validiert (ungültige optionale Felder und unbekannte Keys entfallen); fehlen Pflichtfelder, wird das Event als `legacy.unknown` mit sicherem `typeHint` (erster Codeabschnitt, Zeichenklasse geprüft) angezeigt. `actor`/`trigger` = `unknown`, `schemaVersion` 0, `createdByMemberId` wird **nicht** projiziert. Subject nur, wenn die ID in den Params steht (Transaktionen, Beitragsregeln, Kategorie-/Member-Codes); Altevents für Einkommen und Budgets haben kein Subject.
- Dokument mit `schemaVersion`: muss das Write-Schema vollständig erfüllen. Sonst (andere Version, kaputter Actor, Subject-Mismatch) wird es als `legacy.unknown` mit Actor `unknown` ausgegeben, nicht als geratener Benutzer.
- Ungültige ID/Account/Datum ergeben `{ok:false, reason}`; die Route entscheidet (E06), meldet aber keinen stillen Verlust. Ein Datum ohne gültigen UTC-Instant (z. B. `2026-04-02`, Offset) wird nicht „repariert“.
- Der Decoder liefert getrennt `refs` (`actorUserId`, `initiatedByUserId`) für die serverseitige Namensauflösung; sie verlassen den Server nicht. `subject.deleted` ist ein sicherer Default (`true` bei Codes, die das Subject selbst entfernen: `*.deleted`, `*.removed`, `splitChildDeleted`, sonst `false`); E06 berechnet es beim Lesen gegen die Livedaten neu. Zyklische oder sonst nicht decodierbare Dokumente ergeben `{ok:false, reason:'undecodable'}` statt einer Ausnahme; der Renderer fällt bei kaputten Params auf „Aktivität“ zurück.
- Bekannte Lücke bis E06: `apps/api/src/utils/renderEvent.ts` und `account-overview.ts` laufen unverändert weiter (Anzeige des Zahlers als Actor, Split-Codes als „Aktivität“). Die gemeinsame Quelle ist bis dahin nur für den Vertrag und OpenAPI verbindlich.

## No-Event-Fälle (A-E01)

Bindend als Testpflicht für E04/E05 (`ACTIVITY_NO_EVENT_CASES`): GET/Lesen/Vorschau/UI-Navigation; abgewiesene Requests (400/401/403/404/409/422); Rollback und Fehler (Domain und Event committen gemeinsam, §22.5); No-op-Writes; Retry eines bereits committeten Commands; abgeleitete Neuberechnungen ohne eigenen Fachwrite (Basisregeln stehen im Budget-Event); nutzerbezogene, nicht kontogebundene Member-Stammdaten (Member-CRUD; Kontomitgliedschaft läuft über `account.member.*`); Authentifizierung/Sitzungen. Die Einordnung „Member-CRUD = kein Event“ gilt für Anlegen und Löschen (Member entstehen im Wizard und auf der Stammdaten-Seite immer unmittelbar vor `POST /api/accounts` bzw. `POST /api/accounts/:id/members`; das Konto-Ereignis ist `account.created`/`account.member.added`). **Entscheidung Eigentümer 04.11.2026:** Namens-/E-Mail-Änderungen (`PATCH /api/members/:id`) sollen protokolliert werden. Der Code `member.updated` (Subject `member`, Payload nur `changedFields`, keine E-Mail im Event, ein Event je Konto, in dem das Mitglied steht) ist **noch nicht im Katalog** und wird mit E05 additiv ergänzt (nicht im Plan §22.4, daher eigene A-Bestätigung dort).

## Retention, Löschung, Datenschutz

- Keine TTL, kein automatisches Löschen, keine Rekonstruktion von Vollsnapshots (DEC-0050, INV-DELETE). Events bleiben nach dem Löschen ihres Subjects erhalten; `subject.deleted` wird beim Lesen berechnet, die UI verlinkt gelöschte Subjects nicht.
- Subject-Löschungen schreiben das jeweilige `*.deleted`/`*.removed`-Event im selben Commit. `recurrence.deleted` (D-11) kommt mit E07.
- Individuelle Löschung/Anonymisierung (DSGVO) ist nicht Teil dieses Vertrags und braucht eine eigene Bewertung; `userId` wird nie an Clients ausgegeben.
- Titel/Namen können Personenbezug enthalten und stehen nur, soweit die bestehenden Events sie schon führten (Transaktionstitel, Kategoriename, Wiederkehrer-Titel). Die UI bindet sie ausschließlich als Text (kein HTML).

## Read-/UI-Vertrag (Umsetzung E06)

`GET /api/accounts/:accountId/activity`: JWT + Kontomitgliedschaft (404 einheitlich wie bisher), Standard 20, Maximum 100, Sortierung `occurredAt` absteigend, dann `id` absteigend (stabiler Keyset-Cursor), Filter `code`, `subjectKind`, `subjectId`, `actorKind`, `from` (inklusive), `to` (exklusive). Der Cursor ist undurchsichtig, trägt Konto und Filter-Fingerabdruck (`ActivityCursorPayloadSchema`) und wird bei anderem Kontext mit 422 abgelehnt; die konkrete Signatur/Kodierung legt E06 fest. Die bestehende 20er-Vorschau (`overview.timeline`) behält ihre Form `{id,date,user,text}` und denselben Zugriffsschutz; sie wird in E06 auf den neuen Decoder umgestellt (Actor-Anzeige statt Zahlername). Die Route wird erst mit E06 in `endpoints.ts` aufgenommen (der Routen-Paritätscheck erlaubt keinen Vertrag ohne Route); bis dahin veröffentlicht OpenAPI nur die Schemas `ActivityItem`, `ActivityPage`, `ActivityQuery` unter `components.schemas`.

## Abgrenzung / bewusst offen

- Keine Recurrence-Codes, -Payloads oder Engine (DEC-0052, E07). Keine Konto-Zonen-Codes/-Route (P04, EIT-18/35).
- Keine Persistenzänderung: Validator, Indizes (`accountId,date,_id`, `Member.userId`), Backfill-Verzicht und Migration gehören zu E03; Writer zu E04; Anbindung der Module zu E05.
- AUTH-001/002 und §61.3/§61.4 sind unverändert offen (E02). H08-Ausnahmen und -Nachträge bleiben wie in [h08-freigegebene-ausnahmen.md](../agents/h08-freigegebene-ausnahmen.md) geführt.
- D-04/D-11: Aktiv/Inaktiv als Activity ohne Revision und der minimale `recurrence.deleted` sind Teil von E07; der Katalog hält den Namensraum dafür frei.
