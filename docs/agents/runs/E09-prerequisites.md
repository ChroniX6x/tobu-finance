# E09 – Integrationsvoraussetzung F-3 (13.11.2026)

E09-GO des Eigentümers; Ausgang `feature/events_changes`, `e031bf59e36b1df3ed8c081306bed96369a4ddc1`, clean. E08 ist auf diesem Commit gesichert. Dieser Nachtrag schließt ausschließlich den vor E09 fälligen H08-F-3; er behauptet noch keinen E09-Vollgate-PASS.

## Fehler, Korrektur und echte Probe

Der native Zahlungsbutton im Monatsdrawer war durch `.p-drawer-mask` blockiert. [Roter echter Browserlauf](../../../test-results/e09/f3-before-fix.log) und [Hit-Test/DB-Readback](../../../test-results/e09/f3-Europe-Berlin-blocked.json): `reachesButton:false`, keine Transaktion, Events unverändert 3→3. Der erste Vorlauf fand wegen des Symbolpräfixes im zugänglichen Buttonnamen den Button nicht; erst der korrigierte Selektor lieferte den tatsächlichen Maskenbefund. Keine Erfolgsauswertung dieses Selektorfehlers.

Einzige Produktänderung: Zahlungs-`p-drawer` erhält `appendTo="body"`, damit Drawer und Maske im selben übergeordneten Stacking-Kontext liegen. Keine globale Z-Index-Änderung, keine Fach-/API-/Schemaänderung. Zwei bestehende Kalenderproben verwenden nun echte Buttons statt `requestSubmit`.

[Gezielte Real-Browserprobe](../../../apps/web/tests/e2e/payment-drawer.real.spec.ts), [Rohlog](../../../test-results/e09/f3-after-fix.log): **4/4 Fachfälle + Auth-Setup PASS**, Europe/Berlin, America/New_York, America/Los_Angeles, Asia/Tokyo. Normale Pointer-Hitprüfung und Klick, kein force/DOM-submit; reale JWT/API und isolierte zufällige Mongo-Replica-Fixture. Pro Konto genau eine gebuchte Transaktion über **5000 Minor Units**, genau ein zusätzliches `transaction.created`, korrekter verifizierter Actor und konkreter Zahler, lokaler BankDate-Carrier und daraus abgeleiteter Monatsanker, geschlossener Drawer und Monatsansicht mit exakt5000eingezahlten Minor Units. Einzelreadbacks: `test-results/e09/f3-<Zone>-passed.json`.

Unabhängiger Reviewer `/root/e08_second_review`: [Diff-/Belegreview](../../../test-results/e09/reviewer-f3.md). Beide umgestellten alten Kalenderproben bleiben zusätzlich Bestandteil des anschließenden Pflichtvollgates. Keine Testassertionen/Timeouts abgeschwächt. Rollback: gezielter Revert dieses lokalen Korrekturcommits; keine Daten-/Schemamigration nötig. Der ursprüngliche UI-Fehler wäre dann wieder vorhanden.

## Unveränderte Grenzen

E00–E08 A/Q-PASS-Kette und übrige H08-Fälligkeiten: [E08](E08.md), [H08-Abschluss](H08-ABSCHLUSS.md), [Ausnahmen](../h08-freigegebene-ausnahmen.md). EX-07/A17 vor Legacy-Nutzung/P02, F5/F7/F8 zu P02 und F6 zu P04 bleiben offen. Kein Recurrence-Coding, keine Owner-Konto-Zonenroute, keine Bestandsmigration, kein Push/Merge/Deploy.

Frisches npm ci und API-Build bestanden; unveränderte gepinnte Node24.13.1/npm11.8.0/Lockdatei. Aktueller Audit: **89 = 5 critical / 36 high / 43 moderate / 5 low**. [Unabhängige begrenzte Advisoryprüfung](../../../test-results/e09/reviewer-audit.md) bestätigt keinen konkret erreichbaren kritischen Injectionpfad aus dem neu critical bewerteten Mongoose-countDocuments-Advisory; Mongoose8.19.1 und die übrigen Dependencybefunde bleiben betroffen/offen. Kein Upgrade und keine Sicherheitsfreigabe durch grüne Funktionstests.

E09-Abnahme, clean Integrations-SHA, alle17Pflichtgruppen und signierter Handover folgen erst im getrennten E09-Bericht; bis zu deren tatsächlichen Belegen **A/Q E09 offen**.
