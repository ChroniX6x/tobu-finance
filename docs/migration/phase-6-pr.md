# PR-Entwurf

Ziel: `develop`; Quelle: `chore/monorepo-phase-6`.

**Titel:** Web und API in einem npm-Workspace zusammenführen

## Beschreibung

Frontend und API hatten getrennte Installationen, Startabläufe und mehrfach definierte Schnittstellen. Der gemeinsame Workspace enthält Web unter `apps/web`, API unter `apps/api` und gemeinsame Zod-/OpenAPI-Verträge unter `packages/contracts`. Nach `npm ci` und einmaligem `npm run setup` startet `npm run dev` Web, API, Contract-Watcher und die persistente Docker-MongoDB.

Die Datenbank verwendet eine idempotente Baseline und getrennte Demo-/Test-Fixtures. Historische Migrationen bleiben dokumentiert, werden aber nicht ausgeführt. Die Prüfung `quality:full` umfasst Quellcode, Verträge, Builds, Units, Mock- und Real-API-Browserabläufe, Lifecycle und die Installation eines kompilierten Produktionsartefakts ohne TS-Runner. GitHub Actions prüft Linux/Docker und Windows. ECONNREFUSED-Mocklücken sowie während der Abnahme gefundene Start-, Auth- und Dependency-Probleme sind korrigiert und durch gezielte Tests abgesichert.

## Validierung und Grenzen

- Vollständiges automatisiertes Gate 5 vom Nutzer als erfolgreich bestätigt.
- Phase-6-Änderungen betreffen Übergabedokumentation und die Erweiterung des Push-Triggers auf `master`.
- Vor Merge noch ausfüllen: beide CI-Links, Commit des geprüften Stands, frischer Checkout und manuelle Start-/Stop-/Debug-/Persistenzabnahme.
- Kein neues Hosting und kein Livebetrieb eingerichtet.
- Vollständige Rollenprüfung, automatische Wizard-Owner-Zuordnung und dokumentierte Dependency-Sicherheitsbefunde bleiben offen. Keine Sicherheitsfreigabe durch das Funktionsgate.

Rückfallweg und Übergangsreihenfolge: [Phase-6-Übergabe](https://github.com/ChroniX6x/tobu-finance/blob/chore/monorepo-phase-6/docs/migration/phase-6-handover.md) (Link nach Veröffentlichung des Branches verfügbar). Das API-Repository erst nach erfolgreicher Integration und Abschluss der Abnahmen archivieren.
