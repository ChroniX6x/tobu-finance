# P02 – unabhängiger Zwischenreview des Diffs

Fortschreibung: R1 und R2 wurden inzwischen statisch nachgeprüft und korrigiert; gezielter Integrationlauf15/15PASS gelesen. Historischer F5-Replay und konkrete verbleibende Abdeckung sind im [aktuellen Nachweisreview](independent-coverage-review.md) bewertet. Die folgenden Findings dokumentieren den früheren Zwischenstand, keinen aktuellen offenen R1-/R2-Produktdefekt. Schluss-PASS bleibt ausstehend.

Reviewer `/root/p00_independent_review`,14.11.2026. Basis65dd4f3, laufender dirty P02-Stand; keine Tests oder Implementierung durch Reviewer. Geprüft: aktueller Contract-/API-/DB-/UI-Diff, neue Migration, p02-/Index-/Contracttests und Root-Testmatrix. **Kein A-/Q-Schluss-PASS**, Fullgate noch nicht belegt.

## Bestätigte Verbesserungen und Grenzen

- Legacy-Default nutzt vorhandene UTC-Monats-/Clockhelfer; neue Tx-Writeverträge verbieten frei schreibbare Herkunftsfelder statt bloßem SameAccount-Check. Normale Patch-Logik bewahrt bestehende gespeicherte Legacy-Referenz und prüft sie weiterhin in der Session. Aktiver Web-/Seed-Schreibconsumer von `recurrenceId` ist im statischen Inventar nicht vorhanden.
- ContributionDistributionSchema ist eine gemeinsame präzise Union, behandelt legale irrelevante Nullfelder und prüft CustomSplit-Summe/eindeutige Member. Create/Patch erhalten gezielt422; der restliche ValidateBody-Standard bleibt400. PATCH validiert zusätzlich gespeicherte Distribution, bevor normale Änderungen darauf geschrieben werden.
- Neue Migration20261114221747317-member-user-lookup-index ist additiv/nichtunique und type-only-importierend; vor/nach/ambiguous sowie Down sind anhand eingefrorenem Schema und tatsächlichem Indexinventar definiert. Zusätzliche/geänderte Indizes führen konservativ zu ambiguous statt stiller Übernahme. Kein Diff an vorhandenen Migrationsquellen oder historischer Baseline. Katalog fügt nur die neue Quelle hinzu, alte Prüfsummen bleiben erhalten. Historische E07-Testkataloge werden korrekt auf ihren damaligen Zielstand begrenzt; Artefaktprüfung erwartet ausdrücklich die fünfte kompilierte Migration.
- Bestehende UI-Buttons, Methoden und NGXS-Mutationsaktionen prüfen neue serverabgeleitete callerRole. Kategorieaktionen wurden nicht pauschal Owner-exklusiv gemacht. LegacyDELETE behält die dokumentierte U/F-Policy; keine neue FullDelete-Domain wird vorgezogen.

## Konkrete Zwischenfindings

### P02-R1 – offene Ownereditoren bleiben nach Rollenverlust sichtbar

AccountMasterSection blendet den Einstieg bei member korrekt aus, rendert aber bei bereits `editing()==true` weiterhin das gesamte Ownerformular, auch wenn eine neu geladene VM callerRole=member ausweist. MemberEditorSidebar berechnet isOpen weiterhin ausschließlich aus `editor.kind`; `ReloadMasterData` übernimmt die neue VM ohne den bestehenden Membereditor zu schließen. Damit bleiben Rollen-/Owneraktionen nach Entzug+Reload sichtbar; nur die neu eingeführten Saveguards verhindern den Request still.

Geforderte eng begrenzte Korrektur: offene Ownereditoren bei Capabilityverlust schließen oder nicht mehr rendern, gegebenenfalls vorhandenen lokalen Formzustand kontrolliert verwerfen; Rolle/Accountwechsel im Browser testen. `LoadMasterData` behält außerdem vorerst die alte Owner-VM, während currentAccountId schon neu gesetzt ist. Mutationguards müssen entweder einen passenden aktuellen VM-/Account-/Loadingzustand verlangen oder beim Wechsel VM/editor sicher zurücksetzen. Die serverseitigen Ownerguards bleiben unverändert die eigentliche Sicherheitsgrenze; kein bestätigter Server-ACL-Bypass aus diesem UI-Befund.

### P02-R2 – ungültiges Legacy-Testfixture verletzt bereits den Mongo-Validator

Der gelesene neue p02-Test schreibt `distribution.mode='invalid-legacy'` direkt in contribution_rules und möchte anschließend den Patchguard prüfen. Die eingefrorene Baseline verlangt für mode jedoch ausdrücklich eines von perMember/customSplit/proRataIncome. Dieses Fixtureupdate wird deshalb mit Mongo121 vor dem eigentlichen Testfall scheitern.

Korrektur am Testaufbau: BSON-/Validator-legale, aber fachlich ungültige Distribution verwenden, etwa perMember ohne memberId oder einen CustomSplit mit Summe99. Keine Lockerung des DB-Validators/der Baseline für die Probe. Dies ist ein statisch bestätigter Fixturefehler, kein vom Reviewer ausgeführter roter Test.

### P02-R3 – noch ausstehende Abschlussnachweise

Zum gelesenen Stand fehlen tatsächliche Ausführungsbelege für die neuen Tests, umfassende verbleibende Members-/Orphan-/Unknown-/Legacy-/401-Negativzeilen, gezielte ACL-/Budget-/Category-/Legacy-Recurrence-Races und der explizit fällige historische F5-Vor-Fix-Negativnachweis. Bestehende grüne E05/E08/P00-Raceproben dürfen quellgebunden wiederverwendet werden, ersetzen aber die offene historische Negativanforderung nicht allein. Root ergänzt diese Tests/Nachweise gerade; kein Schluss-FAIL allein wegen des angekündigten Zwischenstands, aber kein abschließendes P02-PASS ohne Belege.

Die neue Indexsuite sieht echte Tools-Up/Down/BSON-/Metadatenprüfungen und eine echte Tools-Restoreprobe bei Ambiguous vor. Der LostReply-Resume-Zweig verwendet dagegen die bestehende MemoryBackup-Testfixture auf echter MongoDB. Im Abschluss beide Backend-/Schichtgrenzen ehrlich benennen und nicht alle Subfälle als Tools-Proben ausgeben.

Keine unabhängigen Tests parallel gestartet. Signiert `/root/p00_independent_review`,14.11.2026; Befunde an Root gemeldet, spätere Korrekturen und finale Ausführungs-/Hashbindung separat nachprüfen.
