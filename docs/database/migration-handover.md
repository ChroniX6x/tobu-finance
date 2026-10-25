# Handover: sichere Datenbankmigrationen

Stand: 25.10.2026. Die Implementierung umfasst lokale Replica Sets, transaktionale Umzug-Migrationen und kontrollierte strukturelle Migrationen. Abschnitt 3 wurde vom Nutzer nach den Befehlen `test:replica`, `test:integration` und `quality:full` als erfolgreich bestätigt. Diese Rückmeldung erfolgte nach Übergabe von `7d1d1d0`; ein neuer vollständiger `quality.json`-Bericht mit Commit-Zuordnung wurde nicht übermittelt. Der Abschluss in Abschnitt 4 ändert Dokumentation, keine Laufzeitlogik oder Tests.

## Einstieg für den nächsten Agent

1. [AGENTS.md](../../AGENTS.md), [Entwicklungsanleitung](../development.md), [Vertragsarchitektur](../architecture/contracts.md) und [offene Arbeiten](../migration/open-issues.md) lesen. Branch, Arbeitsverzeichnis und Nutzeränderungen prüfen; nicht automatisch pushen oder mergen.
2. Für jede Schemaänderung [Migrationserstellung](migration-authoring.md) lesen. Bei DDL oder großen Datenumbauten zusätzlich [struktureller Betrieb und Recovery](structural-migrations.md). Die [Architektur](migration-architecture.md) beschreibt auch den historischen Ausgangspunkt; der aktuelle Nachweis steht im [Umsetzungsstand](migration-progress.md).
3. Transaktional als Standard wählen. Strukturell nur mit nachvollziehbaren Vor-/Nachbedingungen, eindeutig prüfbaren Schritten und geprüftem Wiederherstellungsweg. Keine eigene Migration außerhalb dieses Systems ausführen.
4. Neue Datei erzeugen, alle Up-/Down-/Prüffunktionen implementieren, formatieren, Manifest aktualisieren und eigene isolierte Integrationstests ergänzen. Datei und Katalog gemeinsam committen. Historische Dateien einschließlich bereits zurückgenommener Migrationen unverändert lassen.
5. Build, passende Tests und das vollständige Gate ausführen. Im Handover Commit, Ausgangs-/Zielstand, Testnachweise und Einschränkungen nennen. Kein erfolgreicher Mock-Test ersetzt eine echte Datenbank- oder Restore-Prüfung.

Der aktive Katalog `apps/api/src/database/migration-catalog.ts` enthält derzeit keine fachlichen Migrationen. Die Sicherheitsprüfungen verwenden eigene Testdefinitionen. Die erste echte Modelländerung benötigt deshalb eine neue Migration samt Tests; der historische Snapshot `2026-10-v1.json` bleibt unverändert. Der bisherige Modellvergleich in `apps/api/tests/unit/baseline.test.mjs` muss dann durch einen Test des erwarteten migrierten Schemas ergänzt/ersetzt werden, nicht durch Neugenerierung der Baseline.

## Bestand und Betrieb

| Aufgabe | Einstieg / Verhalten |
| --- | --- |
| Neuinstallation in Entwicklung | `npm run setup`: neue Baseline, erforderliche Migrationen, einmalige Demo; wiederholtes Setup erhält Daten |
| Täglicher Start | `npm run dev`: prüft kompatiblen Stand; kein automatischer Migrations- oder Restore-Lauf |
| Standalone-Volume übernehmen | Ausschließlich `db:replica:init` mit geprüfter Sicherung; Ablauf in [Abschnitt 1](migration-progress.md) |
| Bestehende Datenbank ändern | Writer stoppen/drainieren, `db:migrate:plan`, Ziel prüfen, bestätigtes Up oder Down |
| Transaktionaler Fehler | Sperre behalten; alten Runner stoppen; neuer Plan und explizite Recovery gleichen Commit-Status ab |
| Struktureller Fehler | Runner und Tools stoppen; neuer Plan; ausdrücklich Resume oder Restore wählen; kein Down auf einen Teilstand |
| Erfolgreiche Migration zurücknehmen | Neuer Down-Plan gegen den aktuellen Datenbestand; kein historisches Backup über spätere Nutzerdaten spielen |
| Daten nach Neustart | Persistentes Docker-Volume bleibt erhalten; `dev:down` löscht keine Daten |

MongoDB bleibt auf **9.0.4** gepinnt. Die native MongoDB-8.2-Instanz war ausschließlich eine zusätzliche isolierte Prüfung auf dem Agent-Rechner. Sie ist weder Entwicklungs-Fallback noch eine Änderung des unterstützten Docker-Testziels. Parallelität, Videos und bestehende Browser-Zeitbudgets bleiben unverändert.

## Gebautes Paket und späterer Produktivbetrieb

Die [Artefaktanleitung](../production-artifact.md) beschreibt Paketierung und Start. Das gesamte `dist/release` übertragen und dort `npm ci --omit=dev` ausführen. Schemaänderungen sind ein separater administrativer Schritt **vor** dem App-Start; `npm start` migriert nicht.

Die kompilierte administrative CLI lautet:

```sh
node apps/api/dist/src/database/migration-cli.js plan
```

`NODE_ENV=production` und die explizite `MONGODB_URI` kommen aus der Deployment-Umgebung. Up/Down benötigen den aktuellen Bestätigungshash und bestätigten Writer-Stillstand. Die vollständigen Befehle stehen in der [Agent-Anleitung](migration-authoring.md); zusätzliche strukturelle Bestätigungen, native Database Tools und `TOBU_MIGRATION_BACKUP_DIR` in der [Betriebsanleitung](structural-migrations.md). Geheimnisse gehören nicht in Shell-Argumente, Git, Release-Pakete oder CI-Artefakte.

Vor einem tatsächlichen Produktiveinsatz bleiben deploymentbezogen festzulegen: administratives Wartungskonto, Writer-Drain, TLS/Secrets, geschützter Backup-Speicher und Aufbewahrung, verfügbare Kapazität für Restore-Proben, Tools-/Serverkompatibilität, Umgang mit TTL und anderen Hintergrundschreibern sowie Wiederanlaufkontrolle. Für eine erstmalige produktive Baseline ist ein eigener geprüfter Bootstrap-Ablauf nötig; die Dev-/Seed-CLI ist absichtlich im Produktionsmodus gesperrt. `NODE_ENV=test` ist kein empfohlener Umgehungsweg für echte Produktionsdaten.

Das logische Backup unterstützt reguläre Collections auf Replica Sets unter den dokumentierten Voraussetzungen. Es ersetzt keine unabhängige Ausfallsicherung und deckt nicht pauschal Atlas, Sharding, Search-Indizes oder alle Collection-Typen ab. Strukturelle Migrationen und Restore haben keine sofortige atomare Rollback-Garantie. Bei fehlgeschlagener Verifikation bleibt Wartung aktiv.

## Nachweise und Abschluss auf GitHub

| Prüfung | Nachweis / Grenze |
| --- | --- |
| Lokale API-, Tooling- und isolierte Integrationstests | In den Abschnitten 1–3 dokumentiert; native Zusatzprüfungen ausdrücklich gekennzeichnet |
| Docker 9.0.4, echte Archive, Prozessabbruch/Recovery | Nutzer bestätigt `test:replica` und `test:integration` nach Abschnitt 3 |
| Vollständiges Gate einschließlich Browser/Lifecycle/Artefakt | Nutzer bestätigt `quality:full` nach Abschnitt 3 |
| Produktionsinstallation ohne TS-Runner | Bestehender Artefakttest installiert Produktionsabhängigkeiten frisch und prüft kompilierte CLI, Plan und bestätigtes leeres Up sowie App/Proxy/Auth/Shutdown |
| Fachliche Migration im Release | Aktuell leerer Katalog; jede zukünftige Migration benötigt zusätzliche konkrete Abnahme |
| GitHub-CI für den Abschluss-Commit | Noch separat zu bestätigen; vorhandene Remote-Tracking-Refs sind kein CI-Nachweis |

Der vorhandene Workflow `.github/workflows/quality.yml` hat zwei Prüfungen: **Full quality (Linux, Docker)** führt `quality:full` einschließlich `test:replica` aus; **Windows checks** führt `quality` aus. Windows-CI ersetzt daher nicht die Docker-Prüfung. Der Linux-Job veröffentlicht `quality-results` mit `quality.json` und bei Erfolg `tobu-release`. Backup-Archive werden nicht hochgeladen.

GitHub-Abschluss durch den Nutzer, aus dem Repository-Root des aktuellen Checkouts:

```powershell
git status --short
git branch --show-current
git log -1 --oneline
git push origin feat/safe-database-migrations
```

Vor Push muss das Arbeitsverzeichnis sauber sein und der Branch `feat/safe-database-migrations` heißen. Im Repository `ChroniX6x/tobu-finance` den zugehörigen Pull Request öffnen/aktualisieren. Ziel ist `develop`, sobald dort der Monorepo-Übergang enthalten ist; andernfalls zuerst die Reihenfolge aus der [GitHub-Einweisung](../migration/github-transition.md) klären. Keine älteren Phasen erneut blind mergen.

Beide Checks für **den aktuellen PR-Commit** abwarten. Bei Fehler Logs prüfen; ein grüner älterer Lauf reicht nicht. Den Commit im `quality.json` mit dem geprüften Checkout abgleichen; bei Pull-Request-Workflows kann dies der von GitHub erzeugte Merge-Commit sein. Erfolgreiche Ergebnisse melden, dann Merge bewusst separat durchführen. Dieser Handover führt selbst keinen Push, Merge, Deployment oder Datenbankumbau aus.

## Bestehende offene Arbeiten

Für die weitere Migrationsentwicklung verbindlich berücksichtigen: [Findings S1–S7](migration-findings.md). Sie sind bewertet und priorisiert, aber noch nicht implementiert. S1/S2 vor der ersten echten Migration bzw. Produktiveinsatz und S6b vor produktiven strukturellen Restores beheben. Der vorgeschlagene Code aus dem Review ist kein ungeprüft zu übernehmender Implementierungsauftrag.

Rollen-/Owner-Durchsetzung, dokumentierte Dependency-Sicherheitsbefunde und produktives Hosting bleiben separate Aufgaben. Ein früherer vollständiger Browser-Verbindungsfehler auf localhost wurde nicht ursächlich aufgeklärt; ein späterer Diagnoselauf bestand alle 54 Tests. Das ist kein Grund, Retry-, Mock- oder Timeout-Schutzmechanismen abzuschwächen. Einzelheiten und frühere Befunde bleiben in [offene Arbeiten](../migration/open-issues.md) und [Umsetzungsstand](migration-progress.md) nachvollziehbar.
