# Offene Punkte der Transformation

**Verbindlicher Einstieg für Date/Month und Events:** [Restpunktliste mit Fälligkeit und Abschlusskriterium](../agents/date-event-followups.md). Abgenommene Implementierungsphasen bleiben abgeschlossen; die aufgeführten Folgepflichten müssen vor dem jeweils genannten Gate tatsächlich gelöst werden. Historische Absätze sind kein aktueller Defektkatalog.

## Aktueller Nachtrag E09 – abgeschlossen (13.11.2026)

**A-E09 PASS / Q-E09 PASS**, unabhängig abschließend bestätigt; [E09-Bericht](../agents/runs/E09.md) ist der aktuelle Einstieg. E08 ist auf `e031bf5` committed. H08-F-3 wurde tatsächlich reproduziert, eng korrigiert und unabhängig mit vierzonigen nativen Zahlungs-/Event-/Centproben geschlossen. Ergänzender echter EIT34-Tools-Restore/User-/Systemtrigger-/API-Neustart-Nachweis PASS; erstes Fresh-Vollgate bleibt rot dokumentiert. Tatsächliches neues vollständiges Gate auf clean `27c21d4`:17/17PASS,180/180Integration und30/30Realbrowser mit optionalem Datei-Scheduling1 und unveränderten internen Race-Tests/Timeouts/Assertions. Keine offenen E09-Pflichtfindings; Dokumentationsabschluss41a1558 ist committed, Gatequellen unverändert. **STOP, kein automatischer Folgeschritt.**

Offen bleiben EX-07/A17 vor Legacy-Nutzung/P02, F5/F7/F8 vor P02, F6/P04, F1/gesonderte Bestandskorrektur; umfassende AUTH-001/002/API-001/Memberindex-/Altzuordnungs-/Aufräumpflichten. EIT25–30-Domain bis V08–V28 NOT-RUN/BLOCKED, P04/EIT35/TZ vor D07 separater technischer Rollout. Aktuell89Dependencybefunde (**5critical/36high/43moderate/5low**); keine Upgrades/Sicherheitsfreigabe durch Funktionstests. Produktive S3–S7/S6b, Live-Migration/Backup/Restore, neuer CI-/manueller Abnahmenachweis bleiben separat. Keine automatische Folgeimplementierung oder Produktionsfreigabe.

## Historischer Nachtrag E08 – abgeschlossen (13.11.2026)

**A/Q E08 PASS**, unabhängiger Gesamtbelegreview abgeschlossen: [Bericht](../agents/runs/E08.md). Eigene Reviewer-Negativ-/Writerproben22/22 und AX-Browser3/3, unveränderte E07-Retention-/10k-Rohbelege quellgebunden wiederverwendet. Keine offenen neuen Produktfindings und kein E08-Pflichtrest. Der Reviewer-Nutzungslimitblocker vom09.11 ist aufgelöst. Sechs Test-/Dokumentationsdateien uncommittet, Produktcode und vier Migrationen unverändert. Am13.11 keine Tests wiederholt.

Frisches Release-Vollgate/freshci/clean-HEAD-/EIT34-Abnahme bleibt **E09 NOT-RUN** gemäß Eventplan E09/§22.8; kein E09-/CI-/Produktions-PASS behauptet. Alle folgenden H08-/P02-/ACL-/API-/Security-/Betriebsgrenzen und späteren Recurrence-/P04-/TZ-Nachweise bleiben offen. E09 braucht eigenes GO und seine vollständigen Voraussetzungen.

## Historischer Nachtrag E07 (08.11.2026)

**E07 A/Q PASS**: zwölf Recurrence-Eventprimitiven, enger Writer-Adapter und isolierte generische Mongo-Plattformproben umgesetzt; keine neue produktive Recurrence-Domain/Ensure-/Konto-Zonenroute. Maßgeblich: [E07-Abschlussbericht mit Belegen und zweigeteilter EIT-Matrix](../agents/runs/E07.md), [Integrations-/Betriebsgrenze](../architecture/recurrence-activity-primitives.md). Vollgate17/17 und unabhängiger Review bestanden; dies ist kein neuer CI-/Produktionsnachweis.

Verpflichtend an folgende Agents weitergeben:

- **E08/E09:** unabhängige plattformweite Sicherheits-/Race-/Negativprüfung, Befunde vor dem jeweiligen Gate beheben; E09 verlangt unter anderem passenden clean HEAD und tatsächliche vollständige Prüfbelege. Der E07-Review ersetzt E08 nicht. Jeder Schritt braucht eigenes GO.
- **V08–V28:** echte Recurrence-Domain-/HTTP-/Ensure-/Revision-/FullDelete-Nachweise zu EIT25–30 samt R-EV/IT/E2E bleiben NOT-RUN/BLOCKED, bis diese Domain implementiert und tatsächlich getestet wird. Generische E07-Fixtures ersetzen diese Nachweise nicht.
- **P04 vor D07:** Konto-Zonenfeature samt EIT35/TZ separat umsetzen und prüfen; keine offene Nutzer-Fachentscheidung daraus ableiten.
- **H08/P02 und bestehende Defekte:** EX-07/A17, F3/Drawer, umfassende F5–F8-/AUTH-/P02-Gates, API-001 und Member.userId-Index/Altdatenmehrdeutigkeit/gesonderter Aufräumweg bleiben gemäß [H08-Ausnahmen und Fälligkeiten](../agents/h08-freigegebene-ausnahmen.md) und aktuellen E05/E06-Nachträgen offen. Historische Statusabsätze unten nicht ohne diese neueren Nachträge interpretieren.
- **Security/Betrieb/Abnahme:** bekannte89Dependencybefunde gesondert bewerten und gezielt freigegebene Updates durchführen; keine pauschalen Baseline-/Versionsänderungen. Produktive S3–S7/S6b, neuer PR-CI-Nachweis und ausdrücklich nicht durchgeführte manuelle Abnahmepunkte bleiben separat. Keine Bestandsmigration/Restore/Deployment ohne gesonderten Auftrag.

## Historischer Nachtrag E06 (08.11.2026)

Account-Activity-GET und20er-Vorschau verwenden jetzt denselben aktiven User-/Memberguard und dieselbe sichere Actor-/Legacy-Projektion. Desktop-/Mobile-Read/UI einschließlich Kontextcursor, Filter, gelöschten Subjects und über Seiten geladenen Gruppen ist umgesetzt und mit vollständigem lokalem Gate geprüft: [E06-Bericht](../agents/runs/E06.md), [Read-Handbuch](../architecture/activity-read.md). Das erledigt den E06-Read/UI-Anteil, nicht AUTH-001/002, H08-Ausnahmen, Memberindex/Altdatenbereinigung, P02, E08/E09 oder neue CI-/Produktionsabnahme. Keine Migration oder Legacy-Datenreparatur durch GET.

## Historischer Nachtrag E05 (07.11.2026)

Die AUTH-002–005-Beschreibungen unten dokumentieren den Ausgangsstand vor E05. Aktueller Implementierungs-/Abnahmestand: [E05-Bericht](../agents/runs/E05.md), vollständige [Routen-/Fehler-/Rollback-Matrix](../architecture/activity-rollout.md).

- AUTH-002: Account/Self-Owner/Event werden gemeinsam erzeugt; eigener Self eindeutig wiederverwendet, sonst deterministisch angelegt. Wizard zeigt nicht entfernbares „Du“, wartet auf die echte Konto-ID, sichert abgeschlossene Schritte und verhindert doppelte Saves. Altkonten ohne verifizierten User, mehrere historische Self-Member, Member.userId-Index und ein gesondert freigegebener Aufräumweg bleiben offen. Wizard benennt vorhandene Self-Stammdaten nicht ungeprüft um.
- AUTH-003: Alle tatsächlich mutierenden E05-Pflichtfamilien verwenden den gemeinsamen atomaren Writer und den echten User-Actor. Globaler Member-PATCH erzeugt `member.updated` pro autorisiertem betroffenem Konto. Member POST/Orphan-DELETE bleiben gemäß E01 bewusst ohne Kontoevent. Historische Events unverändert; E06-Actor-UI/E09-Gesamtabnahme bleiben separat.
- AUTH-004: Im E05-Schreibumfang transaktionale Autoritätsprüfung und gemeinsame echte Account-/User-/Member-Revisionswrites; Assignment/Memberänderung/Delete und Antwortverlust mit Zwischenänderung sind real geprüft. Das schließt nicht pauschal P02, F-5 oder das unabhängige E08-Gate.
- AUTH-005: Private servertrusted `createdByUserId` für neue Member, neue additive Migration ohne Backfill; historische Orphans ohne Provenance werden nicht übernommen. Assignment prüft alle bestehenden Konten; früherer unbenutzter Helper entfernt. Member-PATCH verlangt alle betroffenen Kontorechte und protokolliert nur changedFields. Historische Aufräumarbeiten, mögliche Informationsorakel und F-8 bleiben gesondert offen.

API-001, H08-A17/EX-07, F-3 (Drawer-Echtklick), F-5–F-8 als umfassende Folgegates, UI-001 und Dependencybefunde werden nicht als erledigt erklärt. Der zuvor dokumentierte Wizard-Navigationsfehler wird im E05-Umfang korrigiert und separat geprüft; das ist kein nachträglicher pauschaler H08-PASS.

## MIGRATION-S1–S7: Nacharbeiten am Migrationsbetrieb

[Bewertete Findings S1–S7](../database/migration-findings.md): S1 (credentialfreie Zielidentität/Recovery) und S2 (sichere Diagnostik) wurden bei der E03-Wiederaufnahme implementiert und gezielt isoliert geprüft; vollständiger aktueller A/Q-/Reviewstatus im [E03-Bericht](../agents/runs/E03.md). S3–S7 bleiben offen, insbesondere S6b vor produktiven strukturellen Restores. Alte URI-gebundene Journale benötigen den dokumentierten versionsgebundenen Recoveryweg. Keine Produktions-/Bestandsmigration durch E03. Die Dokumentation ersetzt keinen erfolgreichen PR-CI-Lauf oder eine Merge-Freigabe.

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

Status: **im Event-/Kalenderumfang durchgesetzt; spätere Ausbaustufen und P02-Restnachweise offen.** E02 erzwingt Owner-only für Kontoeinstellungen/Mitglieder/Rollen, Finanzdaten und Kategorien bleiben für Owner/Member gleich. Nichtmitglied/Admin ohne Mitgliedschaft404; gesperrte/gelöschte Nutzer verlieren Tokenzugriff. E05 integriert transaktionale Autoritätsprüfung und Domain-/Account-/User-/Memberrevisionen; E08/E09 prüfen echte Negativ-/Race-/Rollbackfälle. Keine pauschale Aussage „Race weder getestet noch behoben“ mehr.

Offen: individuelle Memberrechte, Einladungen, Member.userId-Index, historische Zuordnung/Aufräumen und umfassende F5/F7/F8-/P02-Abnahme. [Verbindliche Fälligkeiten](../agents/date-event-followups.md), [Rollenvertrag](roles-and-access.md), [E05](../agents/runs/E05.md), [E09](../agents/runs/E09.md).

## AUTH-002: Kontoersteller wird Owner; Zuordnung separat nach Zusammenlegung

Status: **neue Kontoanlage/Self-Owner/Wizard seit E05 umgesetzt und abgenommen; historische Daten offen.** Verifizierte Useridentität statt Listenposition/Name/E-Mail; eindeutiger Self wird wiederverwendet oder deterministisch erzeugt. Konto, Self-Owner und Event committen gemeinsam und sind retry-sicher. Der Wizard zeigt „Du“, verhindert Entfernen/Parallel-Saves, sichert Checkpoints und navigiert erst nach echter Konto-ID. Der frühere Promise-Navigationsfehler ist geschlossen; „UI offen“/„pro Konto zwingend neuer Member“ beschreibt nicht mehr den heutigen Ablauf.

Offen bleiben mehrdeutige historische Self-Member, Altkonten ohne verifizierten Nutzer, Member.userId-Index und ein separat freigegebener Aufräumweg. Kein automatisches Bestandsmapping/-backfill. [E05](../agents/runs/E05.md), [Folgepflichten](../agents/date-event-followups.md).

## AUTH-003: Event-Actor und fehlende Events der Konto-Verwaltung

Status: **für die tatsächlichen bestehenden Pflichtpfade E04–E09 geschlossen.** Gemeinsamer atomarer Writer, verifizierter User-/Systemactor, Subject/Trigger, No-op/Failpoint/Rollback/Retry und Kontorechte sind implementiert und real geprüft. Actor ist weder Zahler noch Betroffener. member.updated wird pro betroffenem autorisiertem Konto geschrieben; Member-Create/Orphan-Delete erzeugen gemäß Vertrag kein Kontoevent. GET und20erVorschau sind gleich geschützt.

Historische Events bleiben unverändert/Legacy-Unknown. EIT25–30 auf späterer echter Recurrence-Domainebene sowie P04/EIT35 sind weiterhin NOT-RUN/BLOCKED. [Routenmatrix](../architecture/activity-rollout.md), [E09](../agents/runs/E09.md).

## AUTH-004: Race zwischen Rechteprüfung und Write

Status: **E05-Schreibumfang abgesichert und real geprüft; umfassendes P02-Paket weiterhin offen.** Account-/User-/Memberrevisionen, Assignment/Memberänderung/Delete und echte Fachmutationen laufen im gemeinsamen Writer-/Transaktionsrahmen. Parallele Entziehung/Zuordnung und Antwortverlust mit Zwischenänderung sind geprüft. Die frühere Aussage „nur sequenziell getestet, keine gemeinsame Transaktion“ ist überholt.

Kein pauschaler Abschluss von F5/F7/F8 oder künftig neuen Routen; verbleibende Vor-Fix-/Member-/Altbestandsnachweise vor P02 nach [Restpunktliste](../agents/date-event-followups.md) einzeln übernehmen. [E05](../agents/runs/E05.md), [E08](../agents/runs/E08.md).

## AUTH-005: Member-ID-Orakel und fehlendes `createdBy`

Status: **private Provenance/fail-closed Assignment seit E05 umgesetzt; umfassende Orakel-/Altbestandsabnahme offen.** Neue Member haben servertrusted private createdByUserId; historische Orphans ohne Herkunft werden nicht ungeprüft übernommen. Assignment prüft sämtliche bestehenden Konten, globaler Member-PATCH alle betroffenen Kontorechte und protokolliert nur changedFields. Kategorienamen im Overview sind auf accountId begrenzt; Kontomitglieder/Rollen ändern nur Owner.

Keine vollständige Schließung von F8/AUTH/P02: verbleibende Informationsorakel, historische Mehrdeutigkeiten, Memberindex und Aufräumweg separat prüfen/belegen. [E05](../agents/runs/E05.md), [Folgepflichten](../agents/date-event-followups.md).

## UI-001: Konto-Verwaltung für Nicht-Owner

Status: **offen**. Die Stammdaten-Seite zeigt Nicht-Ownern weiter Konto-, Mitglieder- und Rollenaktionen; der Server antwortet seit E02 mit 403 `OWNER_REQUIRED` und die UI zeigt nur den Fehlertoast. Aktionen für Nicht-Owner ausblenden oder deaktivieren und die Rolle des Nutzers aus dem Konto lesen (kein Eingriff in E02).

## API-001: Beitragsregeln mit falsch geformter `distribution` antworten 500

Status: **offen** (vor P02, F-7). Das Schema erlaubt `distribution: unknown`; ein passendes Schema aber unpassende Form (z. B. `{mode:'perMember', amounts:[…]}`) führt zu HTTP 500 `INTERNAL` statt 422. Betrifft `POST`/`PATCH /api/contribution-rules`. Kein Sicherheitsproblem, aber Robustheitslücke.

## AUTH-006: Owner-Aktionen der Buchungsvorlagen

Status: **offen** (P02/V-Schritte). Der Eigentümer hat am 04.11.2026 festgelegt, dass die exklusiven Buchungsvorlagen-Aktionen nur Owner ausführen. Die Routen existieren noch nicht; sie müssen `requireOwnerContext` verwenden und einen Negativtest für Member bekommen. Individuelle Mitgliedsberechtigungen bleiben einer späteren Ausbaustufe vorbehalten.

## DEV-001: Manuelle Abnahme

Status: erledigt laut Nutzerbestaetigung vom 22.10.2026. Die angeleiteten manuellen Tests im frischen Acceptance-Checkout waren erfolgreich; der komplette automatisierte Lauf auf Commit 3dc359a ebenfalls. Nachweis: [Phase-6-Abnahme](phase-6-handover.md).

## DATE-001: Bei H08 freigegebene Ausnahmen (Nachtrag)

Status: **Date/Month abgenommen mit weiter verbindlichen Folgepflichten.** EX01–06 sowie F2/F4 sind nachgetragen; F3 ist seit E09 mit echten Klick-/API-/Mongo-/Centnachweisen geschlossen. Wizard-Navigation und die500-Zulassung im Parent-Paralleltest sind ebenfalls korrigiert. Historische H08-Aussagen darüber dürfen nicht als aktuelle Fehlerliste verwendet werden.

Offen: EX07/A17 vor Legacy-Nutzung/P02, F1/gesonderte Datenkorrektur, F6/P04 sowie umfassende F5/F7/F8-/P02-Pakete. [Aktuelle Fälligkeiten und Abschlusskriterien](../agents/date-event-followups.md), [historische Freigaben](../agents/h08-freigegebene-ausnahmen.md), [E09](../agents/runs/E09.md).

## UI-001: Vorgemerkte Buchung ohne Datum in der Detailmaske

Status: in Phase 5 behoben. Die Detailmaske bietet bei leerem Datum eine explizite Monatsauswahl; ein Browser-Test prüft Pflichtfeld und Request. Die API berücksichtigt den Monat beim Leeren des Datums und hält Monatsänderungen bei Parent/Splits konsistent; Integrationstests prüfen dies. Kein unsichtbares Ausweichen auf den aktuellen Monat.

## QUALITY-001: Format und Lint

Status: in Phase 5 umgesetzt. ESLint und Prettier sind installiert und verpflichtend. Altbefunde sind gegen Commit 0166768 dokumentiert; neue Regelverletzungen scheitern. Keine automatische Erweiterung der Baselines in CI. Details: [Phase-5-Bericht](phase-5-results.md).

## SECURITY-001: Dependency-Sicherheitsbefunde

Status: **offen.** Letzter belegter Audit13.11.2026:89Befunde,5critical/36high/43moderate/5low. Keine neue Audit-Ausführung durch diese Dokumentationsbereinigung. Frühere82- bzw.4critical/37high-Angaben sind historische Momentaufnahmen.

Der unabhängige begrenzte [E09-Advisoryreview](../../test-results/e09/reviewer-audit.md) bestätigt keinen konkret erreichbaren kritischen countDocuments-Injectionpfad; Mongoose8.19.1 und übrige Abhängigkeiten bleiben betroffen. Gezielte Updates benötigen Ownerfreigabe/Upgradeevidenz und Gates. Keine allgemeine Sicherheits-/Deploymentfreigabe durch funktionale17/17Gates. [Historische Bewertung](phase-5-security.md), [Fälligkeit](../agents/date-event-followups.md).

## TRANSITION-001: GitHub und manuelle Gesamtabnahme

Automatisiertes Gate 5 laut Nutzer erfolgreich. Phase 6 ist freigegeben; die [lokale Uebergabe](phase-6-handover.md) und [GitHub-Einweisung](github-transition.md) sind vorbereitet. Frischer Checkout und manuelle Abnahme sind vom Nutzer erfolgreich bestaetigt. GitHub-CI, Integration und Archivierung bleiben offen. Gate 6 ist noch nicht abgeschlossen.
