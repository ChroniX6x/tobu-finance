# Phase 5: Abhängigkeiten und Sicherheitsbefunde

Stand: 22.10.2026. Grundlage ist der vom Nutzer erzeugte npm-Audit. Die nachvollziehbare Zusammenfassung mit Advisory-Links und dem Vergleich zum Lockfile aus `0166768` liegt in [evidence/phase-5-audit-summary.json](evidence/phase-5-audit-summary.json).

## Ergebnis

82 betroffene Paketeinträge: 4 kritisch, 47 hoch, 26 mittel, 5 niedrig. Das sind weder 82 unabhängige Sicherheitslücken noch 82 nachgewiesene Angriffswege: npm zählt auch Abhängigkeiten, über die Befunde weitergegeben werden. Alle jetzt gemeldeten installierten Paketversionen waren bereits im Ausgangslockfile vorhanden. Dies ist ein Versionsvergleich mit dem aktuellen Audit, kein historischer Audit zum damaligen Zeitpunkt.

Die zunächst installierte ältere typescript-eslint-Version brachte sechs zusätzliche hohe Meldungen über ihre Abhängigkeiten mit. Das Update auf exakt 8.72.0 entfernt diese zusätzlichen Befunde. Die vorhandenen Anwendungsabhängigkeiten wurden dabei nicht pauschal aktualisiert.

## Priorisierung

| Kritischer Paketeintrag | Herkunft und nächster Schritt |
| --- | --- |
| proxy-addr 2.0.7 | Unter anderem API/Express. Proxy-Vertrauen und Deploy-Konfiguration prüfen; kompatibles Express-/Dependency-Update testen. Aktuell ist kein explizites trust proxy konfiguriert, daraus folgt keine allgemeine Entwarnung. |
| form-data 4.0.3 | Web/primeclt → openai → @types/node-fetch. Verwendung dieses Werkzeugs prüfen, anschließend aktualisieren oder bei nachgewiesener Nichtverwendung entfernen. Die Deklaration als Produktionsabhängigkeit belegt keine Auslieferung im Browserbundle. |
| piscina 5.1.4 | Angular-Buildwerkzeuge. Zusammen mit dem Angular-Buildstack aktualisieren und Builds auf beiden Betriebssystemen prüfen. |
| tar 7.5.9 | Unter anderem Angular-CLI-/Tailwind-Installationskette. Installations- und Buildrisiken berücksichtigen; die aufrufenden Pakete gezielt aktualisieren. |

Zusätzlich betreffen Meldungen unter anderem Angular, Mongoose, express-rate-limit, lodash, morgan, uuid und yaml. Die Kennzeichnung productionDependency in der Zusammenfassung beschreibt Lockfile-Metadaten, keine vollständige Analyse der Erreichbarkeit im Produktivbetrieb.

## Getrennte Nacharbeit

1. API-Laufzeitabhängigkeiten und kritische Installationsketten zuerst prüfen; unterstützte Korrekturversionen auswählen und in einem eigenen Branch aktualisieren.
2. Angular, CLI und Buildwerkzeuge abgestimmt aktualisieren; Kompatibilität mit PrimeNG und TypeScript prüfen. Audit-Vorschläge sind keine Kompatibilitätsgarantie.
3. Nicht benötigte Werkzeuge erst nach einer Verwendungsprüfung entfernen. Kein `npm audit fix --force` über den gesamten Workspace.
4. Nach jedem zusammengehörigen Update Lockfile-Diff und Audit vergleichen sowie betroffene Unit-, Integrations-, Browser- und Artefakttests ausführen. Abschließend den vollständigen Gate-5-Lauf wiederholen.

Phase 5 richtet reproduzierbare funktionale Prüfungen ein. Sie behauptet keine abgeschlossene Sicherheitsbereinigung oder Freigabe für einen Livebetrieb. SECURITY-001 bleibt offen; die hier festgehaltenen Updates sind noch nicht umgesetzt.

Quellen für einzelne Befunde: [proxy-addr Advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [form-data Advisory](https://github.com/advisories/GHSA-fjxv-7rqg-78g4). Weitere Advisory-Links stehen unmittelbar bei den Befunden in der Audit-Zusammenfassung.
