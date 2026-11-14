# Buchungsvorlagen – Initialisierung / Quellenblocker

**Nachtrag nach `GO P00`:** Historischer Initialisierungsstand unten. Pflichtlektüre und Quellenpfadabweichung inzwischen geklärt, Docker vom Nutzer gestartet und vollständiges Gate nachgeholt; maßgeblicher aktueller Bericht: [P00](P00.md). Keine Blocker aus diesem alten Zwischenstand ungeprüft fortschreiben.

14.11.2026. Auftrag: ausschließlich Initialisierung und Bestandsprüfung, kein Schritt-GO, keine Implementierung.

## Status und Arbeitsstand

Initialisierung **BLOCKED / unvollständig**; kein A-/Q-Schritt abgenommen (A=NOT-RUN, Q=NOT-RUN). Die vollständige Erstlektüre von Plan01 und seiner Verweiskette gemäß §61.2 ist noch nicht abgeschlossen. Dieser Bericht ist ausdrücklich kein Onboarding-PASS und kein P00-Bericht.

Repository `C:/Users/hoffm/Documents/DevProjects/tobu-finance`, Branch `feature/recurrences`, HEAD `b957347aae308a9c614a9a783b467697174e4285`. Lokales develop zeigt auf denselben SHA; origin/develop lokal auf `5199c5cc9809a658822c3eaedce87bb6d4e083a2`. Keine Remote-Aktualisierung und keine aktuelle PR-/CI-/Branchschutzprüfung durchgeführt; lokale Mergehistorie ist kein CI-Beleg.

Vorgefundene Nutzeränderungen unverändert: ` D docs/agents/leitfaden-vorlagen`, `?? docs/agents/leitfaden-vorlagen.md`. Durch diesen Auftrag ausschließlich dieser Runbericht neu angelegt. Kein Checkout, Stash, Commit, Push, Merge, Reset oder Datenzugriff.

## Quellenprüfung

Der ausdrücklich angegebene externe Pfad `C:/Users/hoffm/Documents/DevProjects/tobu-finance-agent-docs/leitfaden-vorlagen.md` fehlt (Get-Content: ObjectNotFound). Die lokale Fassung `docs/agents/leitfaden-vorlagen.md` wurde als Arbeitsanweisung gelesen; sie nennt selbst diesen Repository-Ablageort. Ihre Identität mit einer externen Fassung kann nicht bestätigt werden. Keine globale/rekursive Suche vorgenommen.

Fünf Fachpläne und beide PNGs im exakten externen Ordner vorhanden und SHA256-geprüft. Bilder noch nicht visuell betrachtet; keine UI-Abnahme. Dokumente noch nicht vollständig eingelesen; Plan01 §61 und ausgewählte Start-/Reihenfolgeregeln geprüft.

| Quelle | SHA256 |
| --- | --- |
| 01_Buchungsvorlagen_Implementierungsplan.md | F92FD310AAD93B6C17520C3F149BEDCB09E14A8CBC6FBB1F4CC520CA7E18C2CA |
| 02_Date_Month_Implementierungsplan.md | C14D32716B4793DCF03F85750420D53727BFE1FCFAE04DA9FAE6FAE367D75D56 |
| 03_Eventsystem_Implementierungsplan.md | 59B884DBE9B447E3C894D18876B7F22D49F924BADB66547943AC83267EEF8BE9 |
| 04_Buchungsvorlagen_UseCases.md | 648FA8E971C4A3BC809C660B6DB2D17D959ABB97CDBCC21A4AAF7766C8057B59 |
| 05_Buchungsvorlagen_UI_Spezifikation.md | E022816A0B83BD5D93A745F212B19CF811C6CC06C98FACE920271E65B9AA3892 |
| edit-page.png | 8BC5BDC960D3FEBE446BB4AD5F5329561F77E53555C11ABB61B7CA5FB55592D3 |
| list-detail-page.png | CFB07E5D216429ACC3B91E7236C2B979999AAEADB2D399D0A0EC2790CBCB442D |
| Repository-Leitfaden .md | 184CEF8ADF3C0A9D44AE6B92AFCF4294DBC6C5C2285BE070D0C84469A3D7E856 |

## Vorgänger und Gatebindung

- [H08](H08-ABSCHLUSS.md): Q-PASS, A-PASS mit freigegebenen Ausnahmen; F3 laut E09 geschlossen. Keine uneingeschränkte Freigabe ableiten.
- [E09](E09.md): historische E00–E09-A/Q-Kette PASS; Vollgate17/17 auf `27c21d40fd4a79f1758e087b27b54cf54d066402`. Dieser Commit ist Vorfahr von HEAD (`git merge-base --is-ancestor`: Exit0).
- [Neuere Reviewkorrekturen](E09-review-fixes.md): Auth-/Proof-/Activity-Theming und vollständige Dock-PATCH-Erfassung nach dem Vollgate geändert. Dokumentierte29Angular-/5Mockbrowser-PASS ersetzen den ausdrücklich ausstehenden Real-API-/Dock-Lauf nicht. Kein neuer Vollgate-PASS auf HEAD.
- `git diff --name-only 27c21d4 HEAD -- apps/api packages scripts`: leer. Web/Auth/Activity/Kalender-Browsertests dagegen betroffen; historische Gateevidenz nicht pauschal auf HEAD übertragen. Wirkung: contracts/api/db unverändert, web/auth/activity/ui und Kalender-Testnachweise betroffen.
- [Verbindliche Folgepflichten](../date-event-followups.md) und [offene Punkte](../../migration/open-issues.md) geprüft: P01-S1/S2-Anwendbarkeit nachweisen; EX07/A17, F5/F7/F8, AUTH-/API-/Altdaten-/Memberindexpflichten vor P02; P04/TZ/EIT35 vor D07; echte EIT25–30-Domainbelege später V08–V28. Security-/CI-/Betriebsfreigaben bleiben separat.
- `token-plan.md` bezeichnet P00 bereits als abgeschlossen. Nicht allein aufgrund des generischen Leitfadenbeispiels erneut P00 starten; dessen übernommene Gatebindung ist noch zu verifizieren. Kein P00-Run unter `docs/agents/runs` in der flachen Bestandsliste vorhanden.

## Tatsächliche Checks und Grenzen

Nur Lese-/Inventurchecks; keine Tests oder Installationen. Node `v24.13.1`, npm `11.8.0` bestätigt. `docker compose version` nicht ausführbar: Docker nicht als Befehl erkannt; Standardpfad `C:/Program Files/Docker/Docker/resources/bin/docker.exe` existiert nicht. Damit lokale Voraussetzung für ausstehende Real-Läufe weiterhin nicht nachgewiesen. Kein nativer DB-Ersatz.

Nächster zulässiger Schritt: Quellenpfadabweichung auflösen und vollständige Initialisierung einschließlich Plan01-Verweiskette und PR-/CI-/Integrationsbelegprüfung abschließen. Vor abhängiger Abnahme benötigt der neuere Webstand echte Real-API-/Dock-Nachweise mit verfügbarer isolierter Docker-/ReplicaSet-Umgebung und eigenem Auftrag. Noch keine belastbare Folge-ID für Implementierung; insbesondere P01 nicht automatisch erforderlich und P02 nicht freigegeben.

STOP: kein Implementierungsschritt ohne eigenes ausdrückliches GO.
