# Offene Punkte der Transformation

## MIGRATION-S1–S7: Nacharbeiten am Migrationsbetrieb

Offen und noch nicht implementiert: [bewertete Findings S1–S7](../database/migration-findings.md). S1 (Credential-freie Zielidentität/Recovery) und S2 (sichere Diagnostik) vor der ersten echten Migration bzw. Produktiveinsatz beheben; erneute TTL-Vorprüfung S6b vor produktiven strukturellen Restores. Dort stehen Prioritäten, abweichende Bewertungen, Abnahmekriterien und akzeptierte Restrisiken. Die Dokumentation ersetzt keinen erfolgreichen PR-CI-Lauf oder eine Merge-Freigabe.

## TEST-001: Vite-Proxy ECONNREFUSED in Mock-E2E

- Status: in Phase 5 behoben und lokal geprüft; 52 Mock-E2E erfolgreich, zusätzlicher Negativtest für fehlende Mocks und Real-API-Tests erfolgreich. Die folgenden Punkte dokumentieren Ursache und Abnahmekriterien.
- Nutzerbericht: `npm run verify:phase3` meldete `GATE 3 AUTOMATED VERIFICATION PASSED`; alle 50 Playwright-Tests liefen erfolgreich, trotz wiederholtem `connect ECONNREFUSED 127.0.0.1:4000`.
- In Phase 4 lokal reproduziert: insbesondere `GET /api/accounts/<id>/overview`, beim Wechsel von der Kontoliste und während Buchungstests. Die übergeordnete Kontoseite lädt ebenfalls die Übersicht; nicht jeder Mock-Helfer fängt diesen zusätzlichen Request ab.
- Playwright startet im Mock-Projekt nur Angular. Nicht abgefangene Requests gelangen deshalb über Vite an den Standard-API-Port 4000, an dem bei diesem Test bewusst keine API läuft.
- Ein grüner Mock-Test beweist nicht, dass sämtliche HTTP-Aufrufe abgefangen wurden. Der Phase-3-Erfolg ist ein vom Nutzer gemeldeter automatisierter Nachweis, kein Nachweis für fehlerfreie Testlogs oder die noch manuell zu prüfenden Punkte.
- Spätere Korrektur: vollständige, vertragskonforme Mocks pro Navigationsablauf; unerwartete `/api`-Requests im Mock-Modus erfassen und mit aussagekräftigem Testfehler abbrechen. Den Real-API-Modus davon ausnehmen. Keine pauschalen leeren 200-Antworten und kein bloßes Unterdrücken der Proxylogs.
- Abnahme: alle Mock-E2E ohne Proxyfehler; bewusst entfernter Mock führt zu einem klaren Fehler mit Methode und Pfad; Real-API-E2E laufen weiter gegen die isolierte API.
- Phase 4 prüft erfolgreiche API-Responses und deren Request-Bodies gegen gemeinsame Verträge. Netzwerk-/Proxyfehler werden damit noch nicht zur verpflichtenden Fehlerbedingung der Mock-Suite.

## AUTH-001: Vollständige Durchsetzung der Rollenentscheidung

Status: **teilweise umgesetzt** (H08-FIX-ACL 01.11.2026, H08-FIX-ACL2 02.11.2026). Die gemeinsame Vertragsschicht ersetzt keine Autorisierung; Zugriffstests bleiben Pflicht. Durchgesetzt ist die Kontomitgliedschaft (Nutzer über `Member.userId` in `Account.members`, 404 für Nichtmitglied/unbekanntes Konto/Altkonto, kein Rollenunterschied, globaler Admin ohne Zugriff) auf `transactions`, `month-view`, `overview`, `planning`, `master-data`, `account-balances`, `carryovers`, `category-budgets`, `member-incomes`, `contribution-rules`, `accounts` (GET/PATCH/Mitglieder), `members`, `accounts/summary` sowie seit H08-FIX-ACL2 `categories` und `recurrences` (Listen ohne `accountId` nur über die eigenen Konten, `accountId` im PATCH unveränderlich → 422 `ACCOUNT_IMMUTABLE`, `customSplit`-/Kategorie-/Member-Referenzen gegen das Konto, 422 `REFERENCE_NOT_IN_ACCOUNT`). Belegt durch `apps/api/tests/integration/account-access.test.mjs` (Details: [H08-FIX-ACL](../agents/runs/H08-FIX-ACL.md), [H08-FIX-ACL2](../agents/runs/H08-FIX-ACL2.md)).

Weiterhin **offen**: individuelle Member-Berechtigungen (spätere Ausbaustufe), Einladung, Index auf `Member.userId`, Altkonto-Aufräumweg, Race zwischen Rechteprüfung und Write. **Seit E02 (04.11.2026, Rollenmodell-Entscheidung des Eigentümers):** Kontoeinstellungen, Mitglieder- und Rollenverwaltung (`PATCH /api/accounts/:id`, `POST/DELETE /api/accounts/:id/members`) sind owner-only (Nichtmitglied/Admin ohne Mitgliedschaft 404, Mitglied 403 `OWNER_REQUIRED`); Finanzdaten und Kategorien (inkl. Löschen unbenutzter) sind für Owner und Member gleich. Die Rolle wird bei jeder Anfrage aus `Account.members` gelesen (`apps/api/src/auth/account-context.ts`). Gesperrte oder gelöschte Nutzer verlieren bestehende Tokens sofort (`requireAuth` prüft `isActive`). Belege: [E02](../agents/runs/E02.md). Die Legacy-Route `recurrences` ist zugriffsgeschützt, fachlich aber unverändert (A17).

## AUTH-002: Kontoersteller wird Owner; Zuordnung separat nach Zusammenlegung

Status: **serverseitig umgesetzt, UI offen** (H08-FIX-ACL). Nutzerentscheidung 22.10.2026: Der Ersteller wird Owner. Entscheidung Eigentümer 01.11.2026: Der Wizard legt automatisch ein Member für den angemeldeten Nutzer an (nicht löschbar, Name ggf. änderbar). Umgesetzt: `POST /api/accounts` verlangt ein mit dem Login verknüpftes Member (sonst 422 `CREATOR_MEMBER_REQUIRED`) und erzwingt dafür `owner`; `POST /api/members` darf `userId` nur auf die eigene ID setzen (sonst 403), `PATCH` ändert `userId` nie, verknüpfte Member sind nicht löschbar (409). Der Wizard sendet das Creator-Member aus dem Auth-User automatisch und ohne eigene Anzeige. **Offen:** Sichtbarkeit und Umbenennung im Wizard-Schritt „Mitglieder“, Wiederverwendung eines vorhandenen verknüpften Members statt eines neuen je Konto (Duplikate), Altkonten ohne verknüpften Nutzer (bleiben blockiert; Aufräumweg ist eine separate freigabepflichtige Datenmigration).
Nutzerentscheidung vom 22.10.2026: Der angemeldete Nutzer soll beim Anlegen eines Kontos Owner werden. Welcher erfassten Person in der Wizard-Mitgliederliste dieser Nutzer entspricht, ist derzeit nicht eindeutig; diese Zuordnung soll separat nach der Zusammenlegung gelöst werden.

Phase 4 vergibt deshalb keine Owner-Rolle anhand der Listenposition. Die Wizard-Mitgliedsreferenzen verwenden zunächst den bisherigen API-Default `member`; automatische Ersteller-Ownership ist damit ausdrücklich noch nicht umgesetzt. Solche neuen Wizard-Konten können bis zur späteren Korrektur ohne Owner bzw. ohne Verknüpfung zum angemeldeten Nutzer entstehen. Dies ist keine fertige fachliche Kontoerstellung.

Spätere Umsetzung: die Nutzeridentität serverseitig aus der authentifizierten Sitzung bestimmen, eine eindeutige Member-Zuordnung herstellen oder die benötigte Auswahl in der UI anbieten, dann den Ersteller als Owner eintragen. Nicht anhand von Reihenfolge, Namen oder ungeprüfter E-Mail gleichsetzen. Tests: Ersteller nicht an erster Listenposition, noch kein verknüpftes Mitglied, wiederholte Erstellung, fremde User-ID im Request, globale Adminrolle ohne zusätzliche Kontorechte. Bereits erzeugte Konten ohne Owner gesondert behandeln.

**Stand E02 (04.11.2026):** `POST /api/accounts` verweigert Konten ohne eigenes, mit dem Login verknüpftes Member (422 `CREATOR_MEMBER_REQUIRED`) und rät keinen Owner. Weiterhin offen (P02/Wizard, §61.3): Account-Anlage und Owner-Verknüpfung sind nicht atomar und nicht retry-sicher, weil die Member vorher über `POST /api/members` entstehen (Wizard-Retry erzeugt Duplikate, der Server legt den Self-Owner-Member nicht selbst an); dieselbe Strecke betrifft den Wizard-Navigationsfehler aus H08. Details: [E02](../agents/runs/E02.md).

## AUTH-003: Event-Actor und fehlende Events der Konto-Verwaltung

Status: **offen** (E04/E05). Der serverseitige Actor-Kontext existiert seit E02 (`apps/api/src/auth/account-context.ts`), ist aber in keinem Event-Writer verdrahtet. Alle 15 `Event.create`-Aufrufe speichern Zahler oder Betroffenen in `createdByMemberId`, nie den ausführenden Nutzer. Keine Events entstehen für `PATCH /api/accounts/:id` (Einstellungen, Mitglieder-Array, Rollen), Konto-Neuanlage, Kategorien, Überträge, Salden und die Legacy-Recurrence; `account.member.added` wird auch bei einer reinen Rollenänderung geschrieben; `PATCH members` erzeugt weder Add- noch Remove-Event. Ein Nachweis „Actor ist der echte Nutzer“ ist erst mit E04/E05 möglich; bis dahin darf keine Abnahme (E09) auf die heutigen Events gestützt werden.

## AUTH-004: Race zwischen Rechteprüfung und Write

Status: **offen** (vor P02, F-5). Rolle und Mitgliedschaft werden vor dem Write gelesen, nicht in derselben Transaktion; parallele Mitgliederänderungen (`save`, `findByIdAndUpdate`) können sich überschreiben oder eine eben entzogene Rolle noch nutzen. Weder getestet noch behoben (Test nur sequenziell).

## AUTH-005: Member-ID-Orakel und fehlendes `createdBy`

Status: **offen** (P02/E03, F-8). `membersAssignable` unterscheidet über 422, ob eine Member-ID existiert und fremd verknüpft ist; ein unverknüpftes, in keinem Konto stehendes Member kann von jedem authentifizierten Nutzer beansprucht werden, der die ID kennt. Die Behebung braucht ein `createdBy` am Member (Schemaänderung mit Migration). Zusätzlich kann jedes Kontomitglied Name und E-Mail sichtbarer Member ändern (`PATCH /api/members/:id`); die Entscheidung dazu (Owner-only oder Ereignis `member.updated`) fällt in E05.

## UI-001: Konto-Verwaltung für Nicht-Owner

Status: **offen**. Die Stammdaten-Seite zeigt Nicht-Ownern weiter Konto-, Mitglieder- und Rollenaktionen; der Server antwortet seit E02 mit 403 `OWNER_REQUIRED` und die UI zeigt nur den Fehlertoast. Aktionen für Nicht-Owner ausblenden oder deaktivieren und die Rolle des Nutzers aus dem Konto lesen (kein Eingriff in E02).

## API-001: Beitragsregeln mit falsch geformter `distribution` antworten 500

Status: **offen** (vor P02, F-7). Das Schema erlaubt `distribution: unknown`; ein passendes Schema aber unpassende Form (z. B. `{mode:'perMember', amounts:[…]}`) führt zu HTTP 500 `INTERNAL` statt 422. Betrifft `POST`/`PATCH /api/contribution-rules`. Kein Sicherheitsproblem, aber Robustheitslücke.

## AUTH-006: Owner-Aktionen der Buchungsvorlagen

Status: **offen** (P02/V-Schritte). Der Eigentümer hat am 04.11.2026 festgelegt, dass die exklusiven Buchungsvorlagen-Aktionen nur Owner ausführen. Die Routen existieren noch nicht; sie müssen `requireOwnerContext` verwenden und einen Negativtest für Member bekommen. Individuelle Mitgliedsberechtigungen bleiben einer späteren Ausbaustufe vorbehalten.

## DEV-001: Manuelle Abnahme

Status: erledigt laut Nutzerbestaetigung vom 22.10.2026. Die angeleiteten manuellen Tests im frischen Acceptance-Checkout waren erfolgreich; der komplette automatisierte Lauf auf Commit 3dc359a ebenfalls. Nachweis: [Phase-6-Abnahme](phase-6-handover.md).

## DATE-001: Bei H08 freigegebene Ausnahmen (Nachtrag)

Status: teilweise nachgetragen, weiter offen. Der Eigentümer hat am 02.11.2026 CAL-06/08/09/22/25/26 als teilweise belegt und A17 (`recurrences.ts` `activeFrom`) als bekannte Fehlfunktion für die H08-Abnahme freigegeben, mit Pflicht zum späteren Nachtrag. Mit H08-NACHTRAG-TESTS (Commit `a7380e4`) sind die testbaren Ausnahmen EX-01–EX-06 sowie F-2 und F-4 durch Tests belegt; **offen** bleiben EX-07/A17 (P02), F-1, F-3 (Drawer-Echtklick, möglicher UI-Defekt), F-5–F-8. Zwei neue, nicht kalenderbezogene Produktbefunde stehen im [Bericht](../agents/runs/H08-NACHTRAG-TESTS.md) (Wizard-Navigation auf `[object Promise]`, Drawer-Maske). Liste, Belege und Fristen: [H08-Ausnahmen](../agents/h08-freigegebene-ausnahmen.md). Zusammenfassung und offene Punkte: [H08-Abschlussbericht](../agents/runs/H08-ABSCHLUSS.md). F-1 vom Eigentümer am 03.11.2026 zur Kenntnis genommen.

## UI-001: Vorgemerkte Buchung ohne Datum in der Detailmaske

Status: in Phase 5 behoben. Die Detailmaske bietet bei leerem Datum eine explizite Monatsauswahl; ein Browser-Test prüft Pflichtfeld und Request. Die API berücksichtigt den Monat beim Leeren des Datums und hält Monatsänderungen bei Parent/Splits konsistent; Integrationstests prüfen dies. Kein unsichtbares Ausweichen auf den aktuellen Monat.

## QUALITY-001: Format und Lint

Status: in Phase 5 umgesetzt. ESLint und Prettier sind installiert und verpflichtend. Altbefunde sind gegen Commit 0166768 dokumentiert; neue Regelverletzungen scheitern. Keine automatische Erweiterung der Baselines in CI. Details: [Phase-5-Bericht](phase-5-results.md).

## SECURITY-001: Dependency-Sicherheitsbefunde

Der Audit vom 22.10.2026 meldete 82 betroffene Paketeintraege (4 kritisch, 47 hoch, 26 mittel, 5 niedrig). Die gemeldeten Versionen waren bereits vor Phase 5 vorhanden. Sechs voruebergehend durch die Lint-Werkzeuge hinzugekommene Meldungen entfielen mit typescript-eslint 8.72.0. Die anschliessende Verschiebung von primeclt nach devDependencies entfernt diese Kette aus der Produktionsinstallation, beseitigt aber nicht ihre Sicherheitsbefunde in der Entwicklungsumgebung. Der Audit ist eine historische Momentaufnahme, kein neuer Scan nach der Verschiebung. Siehe [Bewertung](phase-5-security.md).

## TRANSITION-001: GitHub und manuelle Gesamtabnahme

Automatisiertes Gate 5 laut Nutzer erfolgreich. Phase 6 ist freigegeben; die [lokale Uebergabe](phase-6-handover.md) und [GitHub-Einweisung](github-transition.md) sind vorbereitet. Frischer Checkout und manuelle Abnahme sind vom Nutzer erfolgreich bestaetigt. GitHub-CI, Integration und Archivierung bleiben offen. Gate 6 ist noch nicht abgeschlossen.
