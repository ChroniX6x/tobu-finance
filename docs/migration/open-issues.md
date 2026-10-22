# Offene Punkte der Transformation

## TEST-001: Vite-Proxy ECONNREFUSED in Mock-E2E

- Status: offen; gezielte Behebung vor der Gesamtabnahme in Phase 5.
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

Der Nutzer bestätigte am 22.10.2026 den automatisierten Gate-3-Erfolg auf dem anderen Rechner. Für Ctrl+C im Terminal, Hot Reload, VS-Code-Debugging und den Erhalt einer über die UI angelegten Buchung liegt in diesem Chat noch kein separater manueller Nachweis vor. Siehe [Phase-3-Prüfung](phase-3-verification.md). Phase 4 wurde ausdrücklich zur Fortsetzung freigegeben; diese Punkte bleiben für die Gesamtabnahme sichtbar.

## UI-001: Vorgemerkte Buchung ohne Datum in der Detailmaske

Der gemeinsame HTTP-Vertrag unterstützt `status=pending`, `bookDate=null` und einen expliziten Monat. Die Detailmaske hat bislang kein entsprechendes Monatsfeld und sendet beim Leeren des Datums keinen Ersatzmonat. Ein automatisches Zuweisen zum aktuellen Monat wäre eine nicht sichtbare fachliche Entscheidung. Die Monatsauswahl und die passende Formularvalidierung sind vor vollständiger funktionaler Abnahme gesondert zu ergänzen; API-/Vertragstests decken den gültigen Request bereits ab.
