# Phase 4 – API-Verträge konsolidieren

Stand: 22.10.2026. Branch: `chore/monorepo-phase-4`, aufbauend auf `757e669` (Phase 3). Phase 4 wurde ausdrücklich freigegeben. Kein Merge nach develop und kein Push im Rahmen dieser Phase.

## Umsetzung

- Privates Workspace-Paket `@tobu/contracts` mit echten ESM-Exports, Deklarationen, browsergeeigneten Zod-Schemas und gemeinsamer Build-Reihenfolge.
- Buchungsrequests einschließlich Month/BookDate, Defaults, Patch, Querynormalisierung, Pagination, Sortierung und serialisierten Response-/Splitformen zusammengeführt.
- Weitere Requestgruppen und Auth verlagert; gemeinsame Response-Schemas für Ressourcen, Zusammenfassungen, Monats-/Kontoübersicht, Stammdaten und Planung ergänzt.
- Vollständiges Inventar der 50 implementierten API-Routen; OpenAPI 3.1 und Inventar aus derselben Quelle generiert, mit Driftprüfung.
- API-Responseprüfung im Testmodus, gemeinsame Typen im Web, Mock-/Real-API-Vertragsprüfungen und positive/negative Tests ergänzt.
- Build und gemeinsamer Dev-Start berücksichtigen Contracts; `npm run dev` startet auch deren Watcher.

Details: [Vertragsarchitektur](../architecture/contracts.md), [Inventar](../architecture/api-endpoints.md).

## Beim Abgleich notwendige Korrekturen

- Kontoübersicht: tatsächliche API-Felder `monthlyDueMinor`, `paidAmountMinor`, `sumMinor` statt bisheriger abweichender Frontend-/Mocknamen; nullable Felder korrekt modelliert.
- Ressourcen: `_id` und Konto-Mitgliedsreferenzen aus der echten API werden in UI-Modelle übersetzt. Mocks verwenden echte 24-stellige Hex-ID-Formate und vollständige Wire-Responses.
- Schnellerfassung: Datum vor dem HTTP-Request in ISO-Datetime umwandeln; der bisherige Test auf einen reinen Tagesstring hatte den API-Widerspruch bestätigt statt verhindert.
- CreateTransactionDto erlaubt nun `month` für vorgemerkte Buchungen ohne Buchungsdatum. Die HTTP-Vertragsfälle sind getestet; die vorhandene Detailmaske hat weiterhin keine eigene Monatsauswahl für diesen Sonderfall (siehe offene Punkte).
- `categoryIds[]` wird vor statt nach der Zod-Prüfung normalisiert. Ungültige Werte liefern nun 400 statt eines möglichen Mongoose-Fehlers.
- Wizard: ersetzt nicht unterstützte Account-Felder (`memberIds`, `balances`, `monthlyIncomes`, `monthlyPlannedContributions`) durch die vorhandenen Ressourcen-Requests. Saldo, Einkommen und positive Kategorie-Budgets gehen damit an die zuständigen Endpunkte. Auf Nutzerentscheidung wird die Zuordnung des angemeldeten Erstellers zur Owner-Mitgliedschaft separat nach der Zusammenlegung umgesetzt (AUTH-002). Keine Owner-Vergabe anhand der Listenposition; die Mitgliedsreferenzen verwenden bis dahin den bisherigen API-Default `member`. Die fachliche Kontoerstellung ist damit noch nicht vollständig abgenommen.
- Das Formularfeld `title` von Beitragsregeln wird auf die vorhandene `description` abgebildet, statt einen vom Server verworfenen Titel zu senden.
- Unbenutzte Frontendmethode für das nicht implementierte `GET /api/transactions/:id` entfernt; kein neuer API-Endpunkt eingeführt.

## Lokale Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Installation/Workspace-Link | `npm install --ignore-scripts --offline --no-audit --no-fund` erfolgreich; neue Contracts-Verknüpfung, keine allgemeinen Paketupdates |
| Workspace-Provenienz und Lockfile | erfolgreich |
| API-/Web-Typechecks einschließlich Testtypen | erfolgreich |
| API- und Angular-Produktionsbuild | erfolgreich; bestehende Angular-Warnungen zu SCSS-Budget, lodash und preloading.css bleiben |
| Vertrags-/TypeScript-Negativtests | 7 Laufzeittests erfolgreich, Typ-Negativfälle erfolgreich |
| OpenAPI-/Inventar-/Browsergrenzencheck | erfolgreich, 50 Routen |
| Tooling | 3 Tests erfolgreich |
| API-Unit | 5 Tests erfolgreich |
| Web-Unit | 4 erfolgreich mit separat über Playwright gestartetem Chrome; regulärer Karma-Launcher scheitert hier an GPU-/Sandboxfehlern, auch mit disable-gpu |
| Mock-Playwright | 50 erfolgreich, mit lokalem Chrome, Video aus und separat verwaltetem Angular-Testserver auf Port 4214; beim regulären Playwright-Webserver-Shutdown hängt diese Umgebung |
| API-Integration | 11 Tests inkl. Obertest erfolgreich mit isolierter nativer MongoDB 8.2; echte HTTP-/JSON-Antworten, Splitregeln und Datenbank geprüft |
| Vollständiges Gate mit Docker MongoDB 9.0.4 | noch offen: Docker-Pipe und lokale Docker-Konfiguration sind in dieser Sitzung nicht zugreifbar |
| Gemeinsames Hot Reload / Real-API-Browser unter Docker | noch auf dem Docker-Rechner zu bestätigen |

Die native Diagnose ersetzt den Nachweis mit `mongo:9.0.4` nicht. Testdaten wurden in separaten, zufällig benannten Datenbanken angelegt und wieder entfernt. Keine Entwicklungsdatenbank wurde zurückgesetzt.

Nach der abschließenden Owner-Entscheidung wurden alle 13 Wizard-Tests erneut erfolgreich ausgeführt; ebenso die Typechecks, sieben Vertragstests und Workspace-/OpenAPI-Prüfungen.

## Gesammelte Schritte auf dem Docker-Rechner

Zuerst den Phase-4-Stand auf diesen Rechner übertragen bzw. nach einem gesondert beauftragten Push den Branch auschecken. Phase 4 wird durch diesen Auftrag nicht automatisch gepusht.

Im Repository-Root in derselben PowerShell:

```powershell
npm ci
npm exec --workspace=@tobu/web -- playwright install chromium
$env:CHROME_BIN = (node -p "require('@playwright/test').chromium.executablePath()")
npm run verify:phase4
```

Erwartung: `GATE 4 AUTOMATED VERIFICATION PASSED`. Der Befehl umfasst Workspace, Typechecks, Verträge/OpenAPI, Builds, Tooling, API-/Web-Unit, Mock-E2E, isolierte Docker-Integration und Real-API-E2E. Fehlgeschlagene Teilprüfungen beenden ihn mit Fehlerstatus; nichts wird still übersprungen. Die bekannte Proxylog-Ausgabe in Mock-E2E bleibt als TEST-001 offen.

Danach `npm run dev` starten und Contracts-Hot-Reload prüfen: vorübergehend beispielsweise die minimale Titellänge in `packages/contracts/src/transactions.ts` ändern, die automatische Übersetzung beobachten und eine passende Buchung über die API prüfen. Die Änderung wieder zurücknehmen. API-Neustart und Wiederherstellung der ursprünglichen Validierung kontrollieren; danach mit Ctrl+C beenden. Dies ist ein lokaler Test, keine zu commitende fachliche Änderung.

Die noch nicht bestätigten manuellen Phase-3-Fälle und die Proxyfehler sind in [open-issues.md](open-issues.md) zusammengefasst. Gate 4 wird erst nach dem fehlenden Docker-/Browsernachweis vollständig als bestanden markiert. Nach dieser Phase auf weitere Nutzeranweisung warten; Phase 5 beginnt nicht automatisch.
