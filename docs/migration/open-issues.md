# Offene Punkte der Transformation

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

Die gemeinsame Vertragsschicht ersetzt keine Autorisierung. Die in [roles-and-access.md](roles-and-access.md) dokumentierten Lücken und Zugriffstests bleiben als eigener Umsetzungspunkt bestehen. Ein erfolgreicher Vertragstest für eine 403-Antwort belegt nicht, dass alle Routen diese Antwort im richtigen Fall liefern.

## AUTH-002: Kontoersteller wird Owner; Zuordnung separat nach Zusammenlegung

Nutzerentscheidung vom 22.10.2026: Der angemeldete Nutzer soll beim Anlegen eines Kontos Owner werden. Welcher erfassten Person in der Wizard-Mitgliederliste dieser Nutzer entspricht, ist derzeit nicht eindeutig; diese Zuordnung soll separat nach der Zusammenlegung gelöst werden.

Phase 4 vergibt deshalb keine Owner-Rolle anhand der Listenposition. Die Wizard-Mitgliedsreferenzen verwenden zunächst den bisherigen API-Default `member`; automatische Ersteller-Ownership ist damit ausdrücklich noch nicht umgesetzt. Solche neuen Wizard-Konten können bis zur späteren Korrektur ohne Owner bzw. ohne Verknüpfung zum angemeldeten Nutzer entstehen. Dies ist keine fertige fachliche Kontoerstellung.

Spätere Umsetzung: die Nutzeridentität serverseitig aus der authentifizierten Sitzung bestimmen, eine eindeutige Member-Zuordnung herstellen oder die benötigte Auswahl in der UI anbieten, dann den Ersteller als Owner eintragen. Nicht anhand von Reihenfolge, Namen oder ungeprüfter E-Mail gleichsetzen. Tests: Ersteller nicht an erster Listenposition, noch kein verknüpftes Mitglied, wiederholte Erstellung, fremde User-ID im Request, globale Adminrolle ohne zusätzliche Kontorechte. Bereits erzeugte Konten ohne Owner gesondert behandeln.

## DEV-001: Manuelle Phase-3-Abnahme

Der Nutzer bestätigte am 22.10.2026 den automatisierten Gate-3-Erfolg auf dem anderen Rechner sowie später Gate 4 einschließlich Hot Reload und `min(5)`-Änderung. Für Ctrl+C im Terminal, VS-Code-Debugging und den Erhalt einer über die UI angelegten Buchung liegt noch kein separater manueller Nachweis vor. Siehe [Phase-3-Prüfung](phase-3-verification.md). Diese Punkte bleiben für die Gesamtabnahme sichtbar.

## UI-001: Vorgemerkte Buchung ohne Datum in der Detailmaske

Status: in Phase 5 behoben. Die Detailmaske bietet bei leerem Datum eine explizite Monatsauswahl; ein Browser-Test prüft Pflichtfeld und Request. Die API berücksichtigt den Monat beim Leeren des Datums und hält Monatsänderungen bei Parent/Splits konsistent; Integrationstests prüfen dies. Kein unsichtbares Ausweichen auf den aktuellen Monat.

## QUALITY-001: Format und Lint

Status: in Phase 5 umgesetzt. ESLint und Prettier sind installiert und verpflichtend. Altbefunde sind gegen Commit 0166768 dokumentiert; neue Regelverletzungen scheitern. Keine automatische Erweiterung der Baselines in CI. Details: [Phase-5-Bericht](phase-5-results.md).

## SECURITY-001: Dependency-Sicherheitsbefunde

Der Audit vom 22.10.2026 meldete 82 betroffene Paketeintraege (4 kritisch, 47 hoch, 26 mittel, 5 niedrig). Die gemeldeten Versionen waren bereits vor Phase 5 vorhanden. Sechs voruebergehend durch die Lint-Werkzeuge hinzugekommene Meldungen entfielen mit typescript-eslint 8.72.0. Die anschliessende Verschiebung von primeclt nach devDependencies entfernt diese Kette aus der Produktionsinstallation, beseitigt aber nicht ihre Sicherheitsbefunde in der Entwicklungsumgebung. Der Audit ist eine historische Momentaufnahme, kein neuer Scan nach der Verschiebung. Siehe [Bewertung](phase-5-security.md).

## TRANSITION-001: GitHub und manuelle Gesamtabnahme

Automatisiertes Gate 5 laut Nutzer erfolgreich. Phase 6 ist freigegeben; die [lokale Uebergabe](phase-6-handover.md) und [GitHub-Einweisung](github-transition.md) sind vorbereitet. CI-Nachweis, frischer Checkout, weitere manuelle Abnahmen, Integration und Archivierung bleiben offen. Gate 6 ist noch nicht abgeschlossen.
