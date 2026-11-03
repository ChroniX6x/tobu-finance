# H08 – Abschlussbericht (Date/Month-Harmonisierung, unabhängiger Negativreview)

Zusammenfassung aller H08-Berichte. Die Einzelberichte bleiben als Belege bestehen und werden hier nicht erneut beschrieben: [H08.md](H08.md) (Erstreview, Wiederholung 1 und 2), [H08-FIX-ACL.md](H08-FIX-ACL.md), [H08-FIX-CAL.md](H08-FIX-CAL.md), [H08-FIX-ACL2.md](H08-FIX-ACL2.md), [H08-NACHTRAG-TESTS.md](H08-NACHTRAG-TESTS.md), Ausnahmen: [h08-freigegebene-ausnahmen.md](../h08-freigegebene-ausnahmen.md).

## Ergebnis

| Gate | Status |
| --- | --- |
| Q-H08 | **PASS** (zuletzt `quality:full` 17/17 und Zonenmatrix 5/5 auf clean `a7380e4`) |
| A-H08 | **PASS mit ausdrücklich freigegebenen Ausnahmen** (Freigabe Eigentümer 02.11.2026; F-1 zur Kenntnis genommen 03.11.2026) |

Kein uneingeschränktes PASS: Das Plan-Kriterium „CAL-01–28 reproduziert“ gilt nur unter den unten genannten Ausnahmen. Die Freigabe von H08 ist keine Freigabe für Prod-Migration, Deploy, Bestandsdatenkorrektur, Recurrence- oder Activity-Implementierung.

## ⚠️ Offene Punkte (nicht gelöst)

Alle Punkte stehen mit Zuständigkeit in der Ausnahmen-Doku. Ein späterer Schritt (E09, P02, P04, V14) gilt erst als PASS, wenn die ihm zugeordneten Punkte geschlossen sind.

### Vom Eigentümer zur Kenntnis genommen / freigegeben

| ID | Punkt | Zuordnung |
| --- | --- | --- |
| **F-1** | **Zur Kenntnis genommen (03.11.2026):** Bestehende Konten behalten Basisregeln, die vor dem Fix falsch über die ganze Spanne berechnet wurden. Die **nächste Budget-Änderung eines Kontos** ersetzt dessen gesamte Basisregelmenge und ändert dabei still die Soll-Beträge von Vergangenheitsmonaten auf den korrekten Wert (kein Audit, keine Vorher/Nachher-Liste). Eine gezielte Bestandskorrektur ist nicht erfolgt und braucht eine eigene Freigabe. Änderung der `customSplit` einer Kategorie regeneriert keine Basisregeln (schon vorher so). | Eigentümer; Korrektur nur nach separater Freigabe |
| **EX-07 / A17** | `recurrences.ts` schreibt `activeFrom` mit `new Date()` statt Monatsanker (`lib/clock`). Eine im Anlagemonat angelegte Recurrence ist dort inaktiv. Route ist seit H08-FIX-ACL2 zugriffsgeschützt, der Fehler besteht. | P02 bzw. vor jeder Nutzung des Legacy-Moduls; kein Recurrence-Coding davor |

### Ungelöste Defekte und Lücken (nicht freigegeben, nur dokumentiert)

| ID | Punkt | Zuordnung |
| --- | --- | --- |
| **F-3** | **Möglicher UI-Defekt:** Ein Echtklick auf „Einzahlung buchen“ im Zahlungs-Drawer trifft die Overlay-Maske (`elementFromPoint` = `.p-drawer-mask`; Drawer liegt im Stacking-Context `layout-content-wrapper`, z=1). Nur in Headless-Chromium geprüft, Betroffenheit echter Nutzer nicht belegt. CAL-24 bleibt „teilweise“ (bisher `requestSubmit`). | eigener Fix-Schritt (z. B. `appendTo="body"`/Stacking), vor E09 |
| **Wizard-Navigation** | `wizard.state.ts` ruft `router.navigate(['accounts', <Promise>])` vor der Kontoanlage auf; nach „Next“ landet der Nutzer in `/accounts` mit leerer Liste (Anlage läuft im Hintergrund weiter). Nicht kalenderbezogen; der Mock-Test erkennt es nicht. | eigenes Ticket |
| **F-5** | Kein Negativlauf der ACL-/Budget-Tests gegen den Vor-Fix-Stand; Race-Fenster ACL-Prüfung ↔ Write bei `categories`/`recurrences` nicht atomar und ungetestet. | vor P02 |
| **F-6** | CAL-23: Drawer bucht den lokalen Tag, die Ansicht zeigt den UTC-Monat (laut Plan zulässiger Zwischenbetrieb). | P04 (Kontozeitzone) |
| **F-7** | `transaction-dates.test.mjs` (Parent-Datum parallel) lässt HTTP 500 zu; `members` ohne 401-/Unbekannt-/Altkonto-Zeilen in der ACL-Matrix. | vor P02 |
| **F-8** | `membersAssignable` lässt unverknüpfte Member zu, die in keinem Konto stehen (ObjectId-Orakel); `account-overview.ts:130` löst Kategorienamen ohne `accountId`-Filter auf; jedes Kontomitglied kann Co-Member und Rollen ändern. | P02 / AUTH-001 |

### Weitere bekannte Risiken

- **Echte Nutzerdaten nicht auditiert** (H05); Datenunveränderheit nur an isolierten Fixtures belegt, kein Counts+Schema-Vergleich gegen Echtdaten. Bestandsdaten können `bookDate` mit Uhrzeit enthalten (bleiben lesbar, als Echo änderbar; Bereinigung = eigene Freigabe).
- **Altkonten ohne Nutzerzuordnung sind blockiert**; Aufräumweg ist eine separat freigabepflichtige Datenmigration. `Member.userId` hat keinen Index (Migration nötig). Pro Wizard-Konto entsteht ein weiteres verknüpftes Member (Duplikate möglich, Creator nicht sichtbar/umbenennbar).
- **CI für PR #8–#14 nicht eingesehen**; Verbrauch unbekannt. Alle Aussagen beruhen auf lokalen Läufen.
- **Clients mit `bookDate` samt Uhrzeit für neue Werte** erhalten jetzt 422 (`BOOKDATE_NOT_CARRIER`); Web sendet Träger, unbekannte Altclients nicht geprüft.
- **Budget-Writes** ändern `accounts.updatedAt` (Serialisierung gegen Lost Update); abgelehnte Requests schreiben nichts.
- Owner-spezifische Rechte, Sperren bestehender Sitzungen, Einladungen bleiben AUTH-001-offen. Account-Zonen-Rollout (P04, TZ-01–15) technisch nicht umgesetzt.
- Nicht belegt: DST-Frühling des Servers über die Matrix hinaus; Test-Härtungen laut Reviewer (lockere Regex `988 €`, `dispatchEvent` für Picker-Zellen, `networkidle`, keine halbstündige Zone, EX-03 ohne Erzwingungstest); Zonenmatrix wurde nur für `e2e:real` je Schritt wiederholt.

## Verlauf in Kürze

| Schritt | Ergebnis | Commit (Gate) |
| --- | --- | --- |
| H08 Erstreview | A-H08 FAIL/BLOCKED: keine Kontoprüfung auf den Routen, `bookDate` kein Carrier, `regenerateBaseRules` rückwirkend/nicht atomar; Q-H08 PASS | `37abd1e` |
| H08-FIX-ACL | Mitgliedschaft (404 ohne Unterschied, Altkonten blockiert, Admin ohne Zugriff) auf Kalender-Routen, `accounts`, `members` (Selbstzuordnung/E-Mail-Leak), Referenzprüfung, Wizard legt Creator-Member an; Matrix 33 Einträge | `3d9107e` |
| H08-FIX-CAL | `bookDate` = BankDate-Carrier (Übergangsregel: Nicht-Träger nur als Echo des gespeicherten Werts, sonst 422); Basisregeln monatsgenau, Budget+Event+Regeln atomar; A17 bewusst nicht angefasst | `c772a95` |
| H08 Wiederholung 1 | A-H08 FAIL: `categories`/`recurrences` ohne Kontoprüfung (`PATCH accountId` hebelt Referenzprüfung aus), abgelehnte Budget-Requests schrieben `accounts.updatedAt` | `6fa4502` |
| H08-FIX-ACL2 | Kontoprüfung `categories`/`recurrences`, `accountId` unveränderlich (422), `customSplit.memberId` geprüft, abgelehnte Budget-Requests schreiben nichts; Matrix 43 Einträge | `1296f3b` |
| H08 Wiederholung 2 | Ausnahmen EX-01–EX-07 freigegeben; kein Critical/High; A-H08 PASS mit Ausnahmen | `a2aaead` |
| H08-NACHTRAG-TESTS | EX-01, 02, 04, 05, 06, F-2, F-4 mit Tests geschlossen, EX-03 begründet; F-3 als möglicher UI-Defekt und Wizard-Navigation gefunden | `a7380e4` |

## Was jetzt belegt ist

- **Kalenderkern:** Alle Monats-/BankDate-Umrechnungen über `@tobu/contracts/calendar`; keine zonenlose Fachdatumslogik außer dokumentierten Ausnahmen (Picker-Adapter, Instants, W25 `calculation/*`). Verträge: Monat `YYYY-MM`, Anker UTC-Monatserster, BankDate-Carrier `YYYY-MM-DDT00:00:00.000Z`, Instants getrennt.
- **Tests (zuletzt gelaufen):** CAL-01–28 mit Assertions; mehrere echte Server-/Browserzonen (LA, NY, Tokyo, UTC, Berlin, Havana, Kiritimati, Pago Pago), DST-Beginn/-Ende, Monats-/Jahres-/Schaltjahresgrenze, Parent/Split, Cent-Exaktheit, 0 Writes/0 Events bei Ablehnung, echtes Replica-Set, echte JWT/HTTP, Zwei-Nutzer-ACL-Matrix.
- **ACL:** Alle 15 Routendateien geprüft, keine Route ohne Kontoprüfung, keine erfolgreiche Umgehung (Reviewer, read-only). Öffentlich nur `/health`, `/ready`, `/docs`, `/api/auth/*`.
- **Daten:** Keine Migration, kein Restore/Reset, keine Schema-/Indexänderung, keine Änderung an Baseline, Manifesten oder Fixtures zum Kaschieren, keine Timeout-Lockerung.

## Entscheidung

H08 ist unter den oben genannten freigegebenen Ausnahmen abgeschlossen. **H09 ist erlaubt** (nur Dokumentation/Readiness, eigenes GO nötig). Weiterhin gesperrt: Recurrence-/Activity-Implementierung (E00–E09 A/Q, Account-Zonen-Rollout, separate Freigabe), Prod-Migration, Deploy, Bestandsdatenkorrektur. Merge und Push erfolgen nur auf ausdrückliche Anweisung des Eigentümers.

## Rollback

Siehe Einzelberichte: `git revert` der jeweiligen Fix-Commits (`3d9107e` ff., `c772a95`, `1296f3b`, Tests `a7380e4`). Keine Daten- oder Schemaänderungen; nach Revert der ACL-Fixes sind die Routen wieder ohne Kontoprüfung.

## Hinweis zu den Gates

`quality:full` und die Zonenmatrix liefen zuletzt auf `a7380e4` (clean). Die danach hinzugekommenen Commits (Berichte, Doku-Status, dieser Abschlussbericht) sind reines Markdown und wurden nicht erneut durch ein Gate geprüft.

STOP bis zum nächsten ausdrücklichen GO.
