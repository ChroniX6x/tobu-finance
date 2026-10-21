# Historisches Datenbankarchiv

Diese Dateien dokumentieren den bisherigen Weg zum heutigen Schema. Sie sind weder im TypeScript-Build noch in Setup, Seed oder Migrationsrunner eingebunden. Keine Skripte aus diesem Verzeichnis gegen eine Entwicklungs- oder produktive Datenbank starten.

Quelle: API-Commit `f4b65f6547b5620a5dc92d4711649f5cd335c78b`, in Phase 2 als Snapshot übernommen. Die archivierten Inhalte bleiben unverändert; die beiden Migrationsgeneratoren enthalten bereits die in Phase 2 vorgenommenen Workspace-Anpassungen. Herkunft und Hashes: `docs/migration/evidence/api-import-manifest.json`. `npm run check:workspace` prüft die archivierten Originaldateien gegen diesen Nachweis. Die alten VS-Code-Tasks einschließlich nativer MongoDB-Pfade bleiben ebenfalls nur als Historie erhalten.

| Historischer Schritt | Zweck / heutiger Bezug |
| --- | --- |
| 20250813-reshape_schema | Legacy-IDs in ObjectIds, neue Collections für Beiträge, Einkommen, Salden, Budgets, Wiederholungen; damals Cent-Felder |
| 20250820_add_settings_events | Kontoeinstellungen und Ereignisse |
| 20251009_rename_cents_to_minor | Geldfelder auf amountMinor/closingBalanceMinor etc. umgestellt |
| 20260222_seed_default_users | Alte feste Nutzer und Mitgliedsverknüpfungen; ersetzt durch klar getrennte Demo-Nutzer |
| 20260224_transactions_phase0 | Transaktionsfelder, Status und Splits des damaligen Standes |

Die neue Baseline `2026-10-v1` leitet Collections, Validatoren und Indizes aus den aktuellen Mongoose-Modellen einschließlich Auth-Modellen ab. Geldwerte sind Minor Units, Monatsanker Dates; Modellvalidierung bleibt zusätzlich aktiv. Demo-Daten sind getrennt. `db.json`, alte Fixtures, Backup-/Rollback-Helfer und Seed-Skripte sind historische Eingaben, nicht die Datenquelle des neuen Seeds.

Reproduzierbarkeit: Am 21.10.2026 wurden alle fünf Migrationen mit der archivierten `db.json` auf einer eigenen temporären MongoDB-8.2.2-Instanz erfolgreich ausgeführt. Backup-Datenbank und Hauptdatenbank waren beide isoliert; anschließend wurde die gesamte Diagnoseinstanz entfernt. [Replay-Protokoll](../../migration/evidence/phase-3-legacy-replay.json). Dies ist ein historischer Diagnosevergleich, kein Kompatibilitätsnachweis für MongoDB 9.0.4.

Der Replay erzeugt dieselben elf fachlichen Collections plus `users`, die die heutigen Modelle abdecken. Die neue Baseline initialisiert zusätzlich `auth_sessions` samt TTL-/JTI-Indizes explizit; früher entstanden diese durch den Auth-Laufzeitpfad. Weitere Index-/Validator-Details folgen heute den Modellen und werden unabhängig geprüft, nicht ungeprüft aus dem alten Replay kopiert. Die alten nutzerspezifischen Seeds werden durch Demo-Konten ersetzt. Der Reshape-Schritt benötigt vorhandene Legacy-Collections und ist kein Installer für eine leere DB. Der tatsächliche bisherige Nutzerbestand wurde weder gelesen noch migriert; der Vergleich verwendet ausschließlich die versionierte Beispieldatei.

Künftige Schemaänderungen werden als neue Migrationen unter `apps/api/src/database` ergänzt, niemals durch Reaktivieren dieses Archivs. Aktuell gibt es keine Migration nach der Baseline; `db:migrate` validiert deshalb nur den bekannten Stand. Bei der ersten Schemaänderung müssen ein versionierter, wiederholbarer Übergang, Unterbrechungsbehandlung und der Vergleich „frische Baseline versus migrierter Vorgänger“ gemeinsam implementiert und getestet werden. Ein unbekannter Stand darf nicht durch Umbenennen des Markers akzeptiert werden.
