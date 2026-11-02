# H08: ausdrücklich freigegebene Ausnahmen (Nachtrag-Pflicht)

Freigabe durch den Eigentümer am 02.11.2026 (Chat-Anweisung an den Agenten): Die folgenden Punkte dürfen die Abnahme A-H08 nicht blockieren, **müssen aber später nachgetragen werden**. Die Freigabe gilt nur für H08. Sie ist kein Nachweis, dass die Punkte erledigt oder getestet sind, und keine Freigabe für Prod-Migration, Deploy oder Recurrence-/Activity-Arbeit.

Plan-Kriterium A-H08 verlangt „CAL-01–28 reproduziert“ und „keine Critical/High finance/zone defects“. Die Ausnahmen weichen davon ab und stehen deshalb hier offen, nicht als stilles PASS.

| ID | Ausnahme | Ist-Zustand (Beleg) | Nachtrag fällig |
| --- | --- | --- | --- |
| EX-01 | CAL-06 nur teilweise | Picker-Unit nur in der Zone des Runners, kein DST-Frühling in mehreren Zonen ([H08.md](runs/H08.md)) | vor E09 / vor P04 (Kontozeitzonen) |
| EX-02 | CAL-08 nur teilweise | Zonen-E2E nur Oktober/November, kein Januar/Dezember/Schaltjahr in vier Browserzonen | wie EX-01 |
| EX-03 | CAL-09 nur teilweise | nur `timeline.date`; `createdAt`/`modifiedAt` werden in der UI nicht angezeigt | bei erster UI-Anzeige dieser Felder, spätestens E09 |
| EX-04 | CAL-22 nur gemockt | `calendar-flows.spec.ts` mit gemockter API, nicht gegen echte API | vor E09 |
| EX-05 | CAL-25 teilweise | Dock-Create/Edit im Browser ungetestet; Parent/Split über Detail und API belegt | vor E09 / vor V14 |
| EX-06 | CAL-26 teilweise | nur API-Links getestet, Web-URL/Filter nicht separat | vor E09 |
| EX-07 | A17: `recurrences.ts` `activeFrom` | Legacy-Route schreibt `new Date()` statt Monatsanker (`lib/clock`); eine im Anlagemonat angelegte Recurrence ist dort nicht aktiv. Route ist seit H08-FIX-ACL2 zugriffsgeschützt. Dokumentstatus A17: `SEPARATE-TICKET` | mit P02 bzw. vor jeder Nutzung des Legacy-Moduls; kein Recurrence-Coding davor |

Weitere weiter offene, **nicht** als Ausnahme von A-H08 freigegebene, aber dokumentierte Punkte: Bestands-Basisregeln werden erst bei der nächsten Budget-Änderung des Kontos monatsgenau (Datenkorrektur braucht gesonderte Freigabe), Altkonten-Aufräumweg, `Member.userId`-Index, Race-Fenster ACL-Prüfung↔Write bei `categories`/`recurrences`, echte Nutzerdaten nicht auditiert, CI für PR #8–#14 nicht eingesehen. Siehe [H08.md](runs/H08.md), [H08-FIX-ACL2.md](runs/H08-FIX-ACL2.md).

## Zusätzliche Punkte aus dem Review der H08-Wiederholung 2 (zur Kenntnisnahme, **nicht** ausdrücklich freigegeben)

Der Eigentümer hat nur EX-01 bis EX-07 freigegeben. Die folgenden Punkte hat der Reviewer zusätzlich gefunden; sie sind keine Critical/High-Befunde, aber hier offen geführt. Sie brauchen eine ausdrückliche Kenntnisnahme (F-1) bzw. einen Nachtrag.

| ID | Punkt | Fällig |
| --- | --- | --- |
| F-1 | Die nächste Budget-Änderung eines Kontos ersetzt dessen gesamte Basisregelmenge und korrigiert dabei still Vergangenheitsmonate, die vor H08-FIX-CAL falsch gespannt waren (kein Audit; Bestandsdatenkorrektur braucht gesonderte Freigabe). Änderung der `customSplit` einer Kategorie regeneriert keine Basisregeln (schon vorher so). | Eigentümer: zur Kenntnis nehmen oder gezielte Korrektur freigeben |
| F-2 | CAL-20: Cent-Drift/AccountSnapshot nicht einzeln assertiert | wie EX-01 |
| F-3 | CAL-24: Drawer-Test per `requestSubmit`, kein echter Klick (W04) | wie EX-05 |
| F-4 | CAL-21: Browser-Fall mit Snapshot nur in der Integration | wie EX-04 |
| F-5 | CAL-28: kein Negativlauf der ACL-/Budget-Tests gegen den Vor-Fix-Stand; kein Test des Race-Fensters ACL-Prüfung ↔ Write | vor P02 |
| F-6 | CAL-23/M4: Drawer bucht den lokalen Tag, die Ansicht zeigt den UTC-Monat (laut Plan zulässiger Zwischenbetrieb, bis P04) | P04 |
| F-7 | `transaction-dates.test.mjs` (Parent-Datum parallel) lässt HTTP 500 zu; `members` ohne 401-/Unbekannt-/Altkonto-Zeilen in der Matrix | vor P02 |
| F-8 | `membersAssignable` lässt unverknüpfte Member zu, die in keinem Konto stehen; `account-overview.ts:130` löst Kategorienamen ohne `accountId`-Filter auf; jedes Kontomitglied kann Co-Member ändern (AUTH-001 bewusst offen) | P02 / AUTH-001 |

Regeln für den Nachtrag: Jede Ausnahme wird erst geschlossen, wenn Test oder Fix belegt ist (Status in `docs/architecture/date-month-semantics.md` und diesem Dokument aktualisieren). Ein späterer Schritt (E09, P02, P04) darf nicht als PASS gelten, solange eine ihm zugeordnete Ausnahme offen ist.
