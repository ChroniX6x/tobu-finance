# H08-FIX-ACL – Kontomitgliedschaft auf den Kalender-Routen

Schritt / GO: H08-FIX-ACL (Fix-Schritt vor Wiederholung von H08). Kein H09, keine Recurrence-Arbeit, keine Migration, kein Push/Merge.

## Stand

- Branch `feat/h08-fix-acl` ab `feat/h08-negative-review` (`56424bf`; der H08-Bericht ist nicht in `develop` gemergt). Gate-Commit `3d9107e53a0af0b30a3d9183c927bde8488748d0`, Arbeitsbaum clean. Danach nur dieser Bericht. Lokal, nicht gepusht.
- Umgebung: Windows, Node v24.13.1, npm 11.8.0, Docker (isoliertes Replica-Set über `test-stack`, keine Dev-/Prod-Daten).
- Entscheidungen Eigentümer (nicht neu verhandelt): Mitgliedschaft über `Member.userId`, 404 ohne Unterschied, kein Rollenunterschied, Admin ohne Zugriff, Altkonten blockiert. AUTH-002 (Rückfrage, 01.11.2026): Der Wizard legt automatisch ein Member für den angemeldeten Nutzer an; der Server erzwingt es und macht es zum Owner.

## Umsetzung

- Helper [account-access.ts](../../../apps/api/src/auth/account-access.ts): Mitgliedschaft, Listenbegrenzung auf eigene Konten, Referenzprüfung (Kategorie, Member, Recurrence im selben Konto), `membersAssignable`, `visibleMemberIds`.
- Routen mit Prüfung: `transactions` (GET/POST/PATCH/DELETE), `month-view`, `overview`, `planning`, `master-data`, `account-balances`, `carryovers`, `category-budgets`, `member-incomes`, `contribution-rules`. Zusätzlich `accounts` (GET, `/:id`, `/expanded`, POST, PATCH, Mitglieder-Routen), weil `expanded` sonst dieselben Daten ohne ACL liefert und weil die Kontoanlage den Ersteller zuordnen muss, und `members`.
- Listenrouten ohne `accountId` liefern nur Daten der eigenen Konten.
- Fehlercodes: 404 (Fremde/unbekannt/Altkonto), 422 `REFERENCE_NOT_IN_ACCOUNT`, `MEMBER_NOT_ASSIGNABLE`, `CREATOR_MEMBER_REQUIRED`; 403 `USER_LINK_FORBIDDEN`; 409 `MEMBER_LINKED`, `MEMBER_IN_USE`, `CALLER_WOULD_LOSE_ACCESS`. Ungültige Konto-IDs behalten das bisherige 400 `INVALID_ID` (verrät keine Existenz).
- Web: [wizard-data.service.ts](../../../apps/web/src/app/wizard/state/wizard-data.service.ts) sendet das Creator-Member (Nutzer aus AuthStore, sonst id/E-Mail aus Token-Claims) und verknüpft keine anderen Member. E2E-Mock-Token jetzt JWT-förmig, Wizard-Test erwartet 3 statt 2 Member-Requests (geändertes, gewolltes Verhalten, keine Kaschierung).
- `scripts/check-workspace.mjs`: vier Routen in die Liste angepasster Importdateien aufgenommen (mit Kommentar). `docs/architecture/api-endpoints.md` neu generiert. Viele Routen-Dateien enthalten reine Prettier-Umformatierung (Pflicht der Format-Baseline), z. B. `master-data.ts` hat nur 2 fachliche Zeilen.

## A-/Q-Gates

| Gate | Status | Beleg |
| --- | --- | --- |
| A-ACL (Kalender-Routen) | **PASS** für den Umfang | Zwei-Nutzer-HTTP-Test, Matrix unten |
| A-AUTH-002 (serverseitig) | **PASS** | Test „account creation“ |
| Q-ACL | **PASS** | `quality:full` Exit 0, 17/17 `passed`, Commit `3d9107e`, dirty false (workspace, format, lint, typecheck, contracts, build, tooling, api, web, e2e, replica, integration, e2e:real, lifecycle, package:artifact, test:artifact) |

Nicht behauptet: H08 ist nicht wiederholt, A-H08 nicht erneut bewertet. Die Medium-Befunde 1–3 aus H08 sind unberührt.

## Routenmatrix (Route → Test → Status)

Test: `apps/api/tests/integration/account-access.test.mjs` (echtes Replica-Set, echte JWT, Nutzer Alice/Bob/Admin, Altkonto direkt in der DB). Je Route: Fremdkonto, unbekanntes Konto, Altkonto → 404 mit Snapshot vor/nach über alle Fachcollections (0 Writes, 0 Events); identische Antwort für alle drei; Admin → 404; ohne/mit ungültigem Token → 401; eigenes Konto → Erfolg.

| Route (Methode) | Test | Status |
| --- | --- | --- |
| `/api/transactions` GET, GET Kinder, POST, POST Split-Kind, PATCH `/:id`, DELETE `/:id` | matrix 404/401/Admin, „own account“ | PASS |
| `/api/accounts/:id/month-view`, `/overview`, `/planning`, `/master-data` GET | matrix, „own account“ | PASS |
| `/api/accounts/:id` GET, `/expanded` GET, PATCH, POST `/members`, DELETE `/members/:memberId` | matrix, „own account“, Lockout-Test | PASS |
| `/api/account-balances` GET, PUT, DELETE `/:id` | matrix, „own account“, Liste ohne accountId | PASS |
| `/api/carryovers` GET, PUT, DELETE `/:id` | wie oben | PASS |
| `/api/category-budgets` GET, POST, PATCH, DELETE | wie oben | PASS |
| `/api/member-incomes` GET, POST, PATCH, DELETE | wie oben | PASS |
| `/api/contribution-rules` GET, POST, PATCH, DELETE | wie oben | PASS |
| Fremde categoryId/paidByMemberId/recurrenceId/memberId/Distribution/Parent in eigenen Requests | „foreign category, member, parent…“ (16 Fälle, 0 Writes) | PASS |
| `POST /api/accounts` (Ersteller, fremd verknüpfte/fremde Member) | „account creation“ | PASS |
| `/api/members` GET/POST/PATCH/DELETE (Selbstzuordnung, fremde E-Mails, verknüpft nicht löschbar, in Konto nicht löschbar) | „members routes“ | PASS |
| `GET /api/accounts`, `/api/members` als Nutzer ohne Konto | „list routes“ | PASS (leer) |
| `GET /api/accounts/summary` | unverändert (prüfte bereits) | PASS |
| `/api/categories`, `/api/recurrences` | – | **OFFEN, ungeschützt** |

Nicht belegt: der Test wurde nicht gegen den Code vor dem Fix ausgeführt (kein Negativlauf); er prüft die Matrix ohne Annahme „Test rot vor Fix“.

## Befehle und Exitcodes

- `npm run typecheck` 0, `npm run build` 0, `npm run lint` 0, `npm run format:check` 0.
- `account-access.test.mjs` einzeln gegen temporäre Replica-Set-DB: Exit 0, 10/10 (mehrfach; die ersten Läufe scheiterten an Testdaten, nicht an Produktcode).
- `npm run test:integration` und alle weiteren Gates im Rahmen von `npm run quality:full`: Exit 0 auf `3d9107e`.
- Frühere `quality:full`-Läufe auf `99feb40`, `36a0e37`, `47d9a35` scheiterten: `check:workspace` (Provenance), `check:contracts` (Endpoint-Inventar), `e2e` (Wizard ohne Nutzer, danach lastbedingte Timeouts; Wiederholung mit 2 Workern 45/45). Die Ursachen sind behoben, nicht umgangen. Die Gesamtlaufzeit des letzten Laufs lag weit über der üblichen Dauer; die Uhr im `quality.json` ist nicht auf Plausibilität geprüft.

## Review

Konzept-Reviewer (read-only) auf dem Arbeitsstand: ⚠️. Behoben: Aussperren über DELETE eigener Mitgliedschaft (409), Löschen von Membern, die noch in einem Konto stehen (409). Dokumentiert/offen: Befund 1 (categories/recurrences), 4, 5, 7, 8 (siehe unten). Kein erneutes Review nach den Fixes und dem Wizard-Token-Fallback.

## Offene Risiken

1. **Release-Blocker für Mehrnutzerbetrieb:** `categories` und `recurrences` ungeschützt; beide erlauben per PATCH das Ändern der `accountId` (Umgehung von `REFERENCE_NOT_IN_ACCOUNT`). Nicht aufgenommen, weil nicht unmittelbar berührt (P02).
2. Wizard zeigt das Creator-Member nicht an und erlaubt keine Umbenennung (UI-Entscheidung offen). Pro neuem Konto entsteht ein weiteres verknüpftes Member (Duplikate, kein Unique-Index auf `userId`); verwaiste Member bei Abbruch zwischen Member- und Kontoanlage.
3. Kein Index auf `Member.userId` (jeder geschützte Request liest darüber); ein Index ist eine Schema-Änderung und braucht eine Migration.
4. Annahme: In einem Konto stehen nie fremd verknüpfte Member (`membersAssignable` verhindert es). Mit Einladungen (spätere Schritte) sind E-Mail-Sichtbarkeit und Member-Bearbeitung neu zu bewerten.
5. Race-Fenster: Prüfung und Schreiben in transactions PATCH/DELETE laufen nicht atomar; Kaskaden-Löschen war schon vorher nicht atomar.
6. Altkonten bleiben blockiert; Aufräumweg ist eine separate freigabepflichtige Datenmigration. Echte Nutzerdaten nicht geprüft.
7. Owner-spezifische Rechte, Sperren bestehender Sitzungen und Einladungen bleiben AUTH-001-offen.
8. Zonenmatrix (H06) auf dem Fix-SHA nicht wiederholt.

## Rollback

`git revert 3d9107e 47d9a35 36a0e37 99feb40` (oder Branch `feat/h08-fix-acl` verwerfen). Keine Datenmigration, keine Schemaänderung, keine Datenbank angefasst; nach Rollback sind die Routen wieder ohne Kontoprüfung (bekannte Lücke H08).

STOP bis zum nächsten ausdrücklichen GO (H08-Wiederholung, Medium-Befunde, categories/recurrences, Wizard-UI).
