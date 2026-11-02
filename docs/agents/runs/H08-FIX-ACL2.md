# H08-FIX-ACL2 – ACL für categories und recurrences, schreibfreie Ablehnung bei Budgets

Schritt / GO: H08-FIX-ACL2 (Fix-Schritt vor erneuter Wiederholung von H08), blockierende Befunde aus der H08-Wiederholung ([H08.md](H08.md)). Kein H09, keine Recurrence-/Activity-Implementierung, keine Migration, kein Push/Merge.

## Stand

- Branch `feat/h08-fix-acl2` ab `feat/h08-rerun` (`bf03e38`, H08-Wiederholungsbericht) auf `develop` `6fa4502` (enthält H08-FIX-ACL und H08-FIX-CAL). Arbeitsbaum bei Start clean. Gate-Commit `1296f3bee3ac3fe92178b45211b48538be42c0cd`, Arbeitsbaum clean bei Gate und Zonenmatrix. Danach nur Doku und dieser Bericht. Lokal, nicht gepusht.
- Umgebung: Windows, Node v24.13.1, npm 11.8.0, Docker (isoliertes Replica-Set über `test-stack`, keine Dev-/Prod-Daten).
- Eigentümerentscheidung 31.10./01.11.2026 unverändert angewendet (Mitgliedschaft über `Member.userId`, 404 ohne Unterschied, kein Rollenunterschied, Admin ohne Zugriff).

## Umsetzung

1. **categories / recurrences** ([categories.ts](../../../apps/api/src/routes/categories.ts), [recurrences.ts](../../../apps/api/src/routes/recurrences.ts)), gleicher Helper wie H08-FIX-ACL:
   - GET/POST/PATCH/DELETE prüfen die Mitgliedschaft vor jedem Schreibzugriff; Reihenfolge ACL → Validierung → Write. Liste ohne `accountId` nur über die eigenen Konten (`accountScope`).
   - PATCH ändert `accountId` nie: Abweichung → `422 ACCOUNT_IMMUTABLE` ohne Write, die eigene `accountId` wird akzeptiert und ignoriert; der Fremd-Fall liefert 404 (ACL zuerst), nicht 422 (kein Orakel).
   - `customSplit.memberId`, `categoryId` und `createdByMemberId` werden gegen das Konto geprüft (`422 REFERENCE_NOT_IN_ACCOUNT`, 0 Writes).
   - Kompatibilität geprüft: Web patcht Kategorien mit `{name, customSplit}` (ohne `accountId`), liest Kategorien immer mit `accountId`, der Wizard POSTet mit `accountId`; `recurrences` nutzt das Web nicht. Keine Rückfrage nötig.
   - `recurrences.ts`: `activeFrom: … : new Date()` (A17) unverändert (die Datei wurde dafür komplett neu geschrieben und per Prettier formatiert; fachlich geändert sind nur ACL und `accountId`).
2. **category-budgets** ([category-budgets.ts](../../../apps/api/src/routes/category-budgets.ts)): `writeAtomically` schreibt weiterhin zuerst `accounts.updatedAt` (Serialisierung gegen parallele Budget-Writes), bricht die Transaktion aber bei jedem Ergebnis mit Status ≥ 400 ab. 409 `BUDGET_OVERLAP`, 404 und Konto-verschwunden-404 schreiben damit nichts, auch nicht `accounts.updatedAt`. Echte Schreibkonflikte tragen weiter das Transient-Label und werden vom Treiber wiederholt.
3. Provenance-Liste in `scripts/check-workspace.mjs` um beide Routen ergänzt.

## Tests

- [account-access.test.mjs](../../../apps/api/tests/integration/account-access.test.mjs): Matrix von 33 auf **43** Einträge (je Methode von `categories` und `recurrences`, plus `PATCH … {accountId des Aufrufers}` auf Fremdobjekten), jeweils Fremd-, Unbekannt-, Altkonto → 404 mit Snapshot vor/nach über **alle** Fachcollections (0 Writes, 0 Events), identische Antworten (kein Orakel), Admin → 404, 401 ohne/mit ungültigem Token. Altkonto-Fixture enthält jetzt eine echte Kategorie und eine echte Recurrence statt zufälliger IDs.
- Zusätzlich: eigenes Konto kann Kategorien/Recurrences lesen, anlegen, ändern (auch `accountId` gleich), löschen; `PATCH accountId` auf fremdes Konto → 422 `ACCOUNT_IMMUTABLE`, Übernahme eines fremden Objekts → 404; `customSplit` mit fremdem Member (POST/PATCH), fremde `categoryId`/`createdByMemberId` (POST/PATCH), fremde **echte** `recurrenceId` in Transaktionen (POST/PATCH) → 422, 0 Writes; `409 CATEGORY_REFERENCED` nur für den Besitzer; Listen ohne `accountId` zeigen nur eigene Konten; `GET /api/accounts/summary` (Alice nur ihr Konto, Admin und Nutzer ohne Konto leer, 401).
- Budgets: neuer Test „rejected requests write nothing" (409 `BUDGET_OVERLAP` bei POST und PATCH, 404, 422, 400, jeweils Snapshot vor/nach inkl. `accounts` und Events); ein akzeptierter Write ändert den Snapshot.
- [transaction-dates.test.mjs](../../../apps/api/tests/integration/transaction-dates.test.mjs): Parallelitätstest verschärft: 5 parallele POSTs, **alle 201 (kein 500)**, 5 gespeicherte Budgets, genau eine Basisregel mit 1500.
- Nicht ausgeführt: Negativlauf der neuen Tests gegen den Stand vor dem Fix.

## Routenmatrix (Route → Test → Status)

Test: `account-access.test.mjs` (echtes Replica-Set, echte JWT, Alice/Bob/Admin/„nobody", Altkonto direkt in der DB). Alle Zeilen aus H08-FIX-ACL bleiben (siehe [H08-FIX-ACL.md](H08-FIX-ACL.md)); neu bzw. geändert:

| Route | Test | Status |
| --- | --- | --- |
| `GET /api/categories` (mit/ohne `accountId`) | Matrix 404/401/Admin, Liste nur eigene, nobody leer | PASS |
| `POST /api/categories` | Matrix, `customSplit` fremder Member 422, fremdes Konto 404 | PASS |
| `PATCH /api/categories/:id` | Matrix (+ `accountId` des Aufrufers), `ACCOUNT_IMMUTABLE`, Übernahme 404, `customSplit` 422 | PASS |
| `DELETE /api/categories/:id` | Matrix, `CATEGORY_REFERENCED` nur Besitzer | PASS |
| `GET /api/recurrences` (mit/ohne `accountId`) | Matrix, Liste nur eigene, nobody leer | PASS |
| `POST /api/recurrences` | Matrix, fremde Kategorie/Member 422, fremdes Konto 404, Validierung 400 | PASS |
| `PATCH /api/recurrences/:id` | Matrix (+ `accountId`), `ACCOUNT_IMMUTABLE`, Übernahme 404, fremde Kategorie/Member 422 | PASS |
| `DELETE /api/recurrences/:id` | Matrix | PASS |
| `POST`/`PATCH /api/transactions` mit fremder echter `recurrenceId` | Referenztest | PASS |
| `POST`/`PATCH`/`DELETE /api/category-budgets` abgelehnt | „rejected requests write nothing" | PASS |
| `GET /api/accounts/summary` | eigener Test | PASS |

## A-/Q-Gates

| Gate | Status | Beleg |
| --- | --- | --- |
| A-ACL2 (CAL-28 für `categories`/`recurrences`, §17) | **PASS** | Zwei-Nutzer-HTTP-Matrix, 0 Writes/0 Events |
| A-BUDGET (schreibfreie Ablehnung, Serialisierung erhalten) | **PASS** | Snapshot-Test, verschärfter Parallelitätstest |
| Q-ACL2 | **PASS** | `quality:full` Exit 0, 17/17 `passed`, Commit `1296f3b`, dirty false, 20:56–21:08 UTC |
| Zonenmatrix `e2e:real` | **PASS** | 5/5, je 9 passed, Exit 0 |

Nicht behauptet: H08 ist nicht erneut bewertet; CAL-06/08/09/22/25/26 bleiben teilweise/gemockt (Doku entsprechend geführt, W01/W09/W19/A32 zusätzlich auf `TEILWEISE`).

## Befehle und Exitcodes

- `npm run typecheck`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:workspace`, `npm run check:contracts`: Exit 0.
- Einzelläufe gegen temporäres Replica-Set (zweimal): `account-access`, `transaction-dates`, `month-intervals` zusammen **45/45** Tests, Exit 0.
- `npm run quality:full` auf `1296f3b`: **Exit 0**, `test-results/quality.json`: Commit `1296f3b…`, Dirty false, 17/17 `passed` (workspace, format, lint, typecheck, contracts, test:contracts, build, tooling, api, web, e2e, replica, integration, e2e:real, lifecycle, package:artifact, test:artifact).
- Zonenmatrix (`$env:TZ=…; $env:TOBU_TEST_NOW=…; npm run e2e:real`, Logs `%TEMP%\h08acl2`, nicht im Repo):

| Backend-/Browser-TZ | Uhr (UTC) | Abdeckung | Ergebnis |
| --- | --- | --- | --- |
| America/Los_Angeles | 2026-10-31T23:30Z | Monatsende | 9 passed, Exit 0 |
| UTC | 2028-02-29T23:30Z | Schaltjahr | 9 passed, Exit 0 |
| America/New_York | 2026-12-31T23:30Z | Jahreswechsel | 9 passed, Exit 0 |
| UTC | 2026-11-01T06:30Z | US-Sommerzeitende | 9 passed, Exit 0 |
| Asia/Tokyo | 2026-10-31T23:30Z | positiver Offset | 9 passed, Exit 0 |

- `api-endpoints.md` und OpenAPI neu generiert (`generate-openapi.mjs`): keine Änderung (die Verträge wurden nicht geändert); `check:contracts` grün.
- Zwischenfall: Beim Neuschreiben von `recurrences.ts` wurde die Datei zunächst gelöscht und aus dem zuvor gelesenen Inhalt wiederhergestellt; `git diff -w` bestätigt, dass `activeFrom … new Date()` unverändert ist.

## Review

Konzept-Reviewer (read-only, nur gelesen, kein Test ausgeführt) auf dem Arbeitsstand vor dem Commit: **✅ Bereit für Commit**, kein Critical/High. Umgesetzt: Medium 1 (Test `CATEGORY_REFERENCED`), Medium 2 (Matrixzeilen `PATCH … {accountId}` gegen Fremd/Unbekannt/Altkonto), Low 4 (`accounts.updateOne` ohne Treffer → 404, Transaktion bricht ab). Nicht umgesetzt, ausgewiesen: Low 3 (Statuscode bei ungültiger ID: DELETE `categories` 400 `INVALID_ID`, übrige 404 – kein Existenz-Orakel, bestehendes Verhalten), Low 5/6 (Retries ohne Backoff; theoretisches Fenster zwischen ACL-Prüfung und Write bei Mitgliedschaftsentzug bzw. `customSplit.memberId`-Entzug; `findByIdAndUpdate` filtert nicht nach `accountId`, weil `accountId` unveränderlich ist), gemischter Parallelfall (409 parallel zu Erfolgen). Kein erneutes Review nach den Fixes.

## Offene Risiken

1. A17 (`recurrences.ts` `activeFrom` ohne Monatsanker) bleibt eine aktive Fehlfunktion; die Route ist jetzt zugriffsgeschützt, aber fachlich Legacy.
2. Owner-gebundene Rechte, Sperren bestehender Sitzungen, Einladung, Index auf `Member.userId`, Altkonto-Aufräumweg: weiter offen (AUTH-001/002).
3. Wizard: Creator-Member nicht sichtbar/umbenennbar, ein neues Member je Konto (Duplikate) (aus H08-FIX-ACL).
4. Bestands-Basisregeln wurden nicht korrigiert (H08-FIX-CAL, Freigabe nötig); Seed-Buchungen mit Uhrzeit-`bookDate` bleiben Altwerte.
5. Kleine Race-Fenster zwischen ACL-Prüfung und Write bei `categories`/`recurrences`; nicht atomar (Review Low 6).
6. CAL-06/08/09/22/25/26 nur teilweise/gemockt; DST-Frühling nicht getestet; kein Negativlauf der neuen Tests gegen den Vor-Fix-Stand; keine Echtdaten-Prüfung (nur Fixtures); CI für PR #8–#14 nicht eingesehen.
7. Datenunveränderheit: keine Migration, kein Restore/Reset, keine Schema-/Indexänderung, kein Eingriff in historische Daten; belegt nur durch den Code-Diff (nichts unter `src/database`) und die Snapshot-Tests an Fixtures, nicht durch einen eigenen Counts+Schema-Vergleich in diesem Schritt.

## Rollback

`git revert 1296f3b` (plus Doku-/Bericht-Commit). Keine Migration, keine Schemaänderung, keine Datenänderung. Nach dem Revert sind `categories`/`recurrences` wieder ohne Kontoprüfung (bekannte Lücke H08), abgelehnte Budget-Requests schreiben wieder `accounts.updatedAt`.

STOP bis zum nächsten ausdrücklichen GO (H08-Wiederholung, A17, CAL-06/22/25-Testausbau, Bestandsdatenkorrektur).
