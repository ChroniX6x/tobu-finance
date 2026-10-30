# Tokenbewusste Feature-Umsetzung für ToBu

Stand: 30.10.2026. Arbeitsplan für den Nutzer; keine Feature-Implementierung und kein Schritt-GO. Die externen Dokumente wurden für diese Planung gezielt ausgewertet, nicht vollständig fachlich auditiert. Umsetzungsstatus muss am jeweiligen Code-SHA geprüft werden.

## Aktueller Einstieg: H04

Laut Nutzer am 30.10.2026 ist **P00 abgeschlossen; H03 liegt bereits im PR; aktueller Einstieg ist H04**. P00 und H00–H03 nicht für diesen Sparplan neu starten. H03 im PR bedeutet keinen belegten Merge oder CI-PASS. Vor H04 dessen benötigten H03-Code und Nachweise am tatsächlichen Ausgangsstand prüfen; fehlt die Abhängigkeit, konkret melden statt blind auf `develop` weiterzuarbeiten. H04 braucht sein eigenes GO. Diese Statusmeldung belegt keine einzelnen A-/Q-PASS und keinen H08-/E09-PASS. Vorhandene Berichte und PR-Belege verlinken, fehlende Belege offen lassen.

Praktischer Einstieg: [Leitfaden ab H04](leitfaden-ab-h03.md). Der Dateiname bleibt für bestehende Links erhalten; der Inhalt beginnt bei H04. Der Nutzer muss weder Hashes noch Testkommandos selbst zusammensuchen; das übernimmt der ausführende Agent im jeweiligen Schritt.

## Ziel und Grundsatz

Minimiere den gesamten Verbrauch bis zur belegten Abnahme: Eingabe, Toolausgaben, Ausgabe, Reasoning soweit messbar und Nacharbeit. Kurze Prompts allein helfen wenig, wenn der Agent wiederholt dieselben Quellen durchsucht. Keine Einsparung durch ausgelassene Sicherheitsprüfungen oder verkleinerte Testabdeckung. Keine garantierte Prozentersparnis ohne Messung.

Die fünf lokalen Markdown-Quellen umfassen zusammen etwa 630 KB. Deshalb niemals alle fünf bei jedem GO erneut in den Prompt kopieren. Einmaliges vollständiges Onboarding bleibt gemäß Buchungsvorlagenplan §61.2 Pflicht; dieser Sparplan ersetzt es nicht. Beim Onboarding Dateien vollständig in begrenzten Abschnitten lesen, sodass keine Toolausgabe abgeschnitten wird. Anschließend geprüfte Quellenstände, Abschnittsverweise und Entscheidungen festhalten. Bei Quellenänderung betroffene Verträge und ihre Abhängigkeiten erneut prüfen. In einer neuen Session ohne belastbaren Onboarding-Nachweis das vollständige Onboarding nachholen.

## Quellen und Vorrang

Lokaler Quellenordner: `C:/Users/hoffm/Documents/DevProjects/tobu-finance-agent-docs`.

| Datei | Einsatz |
| --- | --- |
| `01_Buchungsvorlagen_Implementierungsplan.md` | §61 Kontrollvertrag; §59 Datumsvertrag; §57 P04; Kapitel 6–11 und 25.[ID] Aufgaben; neuere Normen 53–61 |
| `02_Date_Month_Implementierungsplan.md` | H00–H08 und alle jeweiligen Tests; §§17–19 aktuelle Freigabe-/Datumsregeln |
| `03_Eventsystem_Implementierungsplan.md` | E00–E09; §§22–24 konsolidierter Vertrag und Einzel-GO |
| `04_Buchungsvorlagen_UseCases.md` | Fachregeln UC-R01–R12 und verknüpfte IT/E2E-Anforderungen |
| `05_Buchungsvorlagen_UI_Spezifikation.md` | Formular, Aktionsmatrix, Fehler-/Leerzustände und GUI-Abnahme |

Die Bilder `edit-page.png` und `list-detail-page.png` nur für relevante UI-Arbeit laden. Der aktuelle explizite Nutzerauftrag und Projektregeln sind zu beachten; die neueren normativen Entscheidungen lösen historische Widersprüche innerhalb der Feature-Pläne auf. Kein Dokument aus einer alten Diskussion als erneute Produktfrage behandeln.

Cloud-Copilot hat keinen Zugriff auf den lokalen Nachbarordner. Vor einem Cloud-Auftrag müssen die benötigten vollständigen normativen Quellen inklusive Verweiskette im erreichbaren Repository oder als tatsächlich abrufbare Anhänge vorliegen. Nur Pfad oder Zusammenfassung genügt nicht. Diesen Export separat vorbereiten; hier werden die Originale nicht dupliziert. Bei unzugänglichen Pflichtquellen BLOCKED melden.

## Reihenfolge der Arbeit

| Abschnitt | Auftrag und Grenze |
| --- | --- |
| Einstieg erledigt | P00 laut Nutzer abgeschlossen. Bestehenden Bericht nutzen; kein neues P00-GO für die Einführung dieses Sparplans. Ein damals blockierter abhängiger Q-Gate wird dadurch nicht nachträglich PASS. |
| Datum ab H04 | H03 liegt laut Nutzer im PR. Aktuell H04 UI-Adapter; danach je eigenes GO für H05 Datenbefund, H06 reale QA, H07 Handover, H08 unabhängiges Negativreview. H00–H03 sind vorgelagert; Belege und integrierten Code prüfen, nicht pauschal wiederholen. H09 nur nachgelagerter Handover. |
| Activity | Je eigenes GO für E00 bis E09. Inventur → Contracts → Actor/ACL → Persistenz → atomarer Writer → Bestandsmodule → Read/UI → Recurrence-Primitiven → unabhängiges Review → Abnahme. E00/E01-Vorarbeit ist laut Vertrag möglich, aber nur eigens beauftragt; E03–E09 brauchen den abgenommenen H08-Stand. |
| Buchungsvorlagen | Nach realen Plattform-Gates die P-/D-/V-Schritte gemäß Detailplan einzeln freigeben. P04 ist eigener Konto-IANA-Zonen-Slice nach H08/E09, vor D07 Current-Ensure; Hauptauftrag §57.2, keine erfundene 25.P04. P01/P02-Sicherheit nicht überspringen. |

Dies ist eine Navigation, keine Ersatz-Taskliste. Die 30 Vorlagenschritte P00–P04, D04–D07, V08–V28 behalten ihre Detailaufträge, Abhängigkeiten und A-/Q-Gates. Auch ein grünes Meilenstein-Gate erlaubt keinen automatischen Folgeschritt.

## Kontext pro Schritt

1. Schritt-ID, explizites GO und genau ein Ergebnis nennen. Keine erneute komplette Featurebeschreibung.
2. Branch, HEAD und Dirty-Status bei jedem Start tatsächlich prüfen; keinen historischen Branchnamen als aktuellen Stand übernehmen. Bei dieser Dokumentanpassung war `develop` ausgecheckt. Den vorgeschriebenen geprüften Ausgangsstand vor Coding verifizieren, laufende Nutzerarbeit erhalten und keinen Branchwechsel allein aus diesem Sparplan ableiten.
3. Projekt-Pflichtdokumente lesen, soweit für diesen Kontext noch nicht aktuell vorhanden. Danach Schrittabschnitt, aktuelle normative Nachträge und referenzierte Anforderungen vollständig lesen; historische Kapitel nur bei relevantem Konflikt.
4. Mit `rg --files` und `rg -n` die tatsächlichen Implementierungs-/Testpfade bestimmen. Pro betroffener Schicht ein vorhandenes Muster prüfen, keine vollständigen Verzeichnis-Dumps.
5. Im Schritt arbeiten, Fehler beheben, passende Tests und alle vorgeschriebenen Gates ausführen. Ganze Logs in Dateien halten; im Kontext Zusammenfassung und relevante Fehlerspannen anzeigen. Keine Secrets oder Finanzdaten in Übergaben.
6. Den kompakten Schrittbericht aus `prompts.md` erstellen. Danach STOP bis zum nächsten ausdrücklichen GO. Keine zusätzlichen Rückfragen zu bereits entschiedenen Fachregeln.

Nicht jede Dateiänderung mit einem ganzen Build prüfen. Sinnvolle zusammenhängende Änderungen bündeln. Vorgeschriebene Builds/Tests am Schrittende bleiben Pflicht. Erfolgreiche Prüfungen auf unverändertem Stand nicht grundlos wiederholen; bei neuem Code und betroffenen Abhängigkeiten neu prüfen. Ein unabhängiger Reviewer erhält Vertrag, Diff und Belege, nicht die gesamte Unterhaltung; er muss selbst prüfen können. Verpflichtende unabhängige Reviews, insbesondere H08/E08, entfallen nicht aus Kostengründen.

## Fachliche Kurzanker gegen teure Fehlstarts

- MonthKey: API `YYYY-MM`, Mongo-Monatsanker erster Tag UTC. BankDate: intern Kalendertag; bestehende und neue JSON-DTOs sowie BSON mit UTC-Mitternachts-Carrier. Kein zweites öffentliches BankDate-Format. Gemeinsame Helfer in `packages/contracts/src/calendar.ts` und freigegebene UI-Adapter verwenden.
- `occurredAt` ist echter UTC-Instant. Activity verwendet bestehende Event-Collection, persistiertes `date`, projiziertes `occurredAt`; keine zweite Historie oder neuer Bus auf Verdacht.
- Fachmutation und zugehörige Events committen gemeinsam. Kein Event bei GET, No-op, Fehler oder Rollback. Nach zulässigem FullDelete bleiben zentrale Events erhalten; genau ein atomarer `recurrence.deleted`. Batch-Gruppierung darf keine nicht atomar belegten Gesamterfolge behaupten.
- §61.3: Ersteller serverseitig als genau ein Owner-Self-Member, Wizard „Du“, atomar und retriesicher. §61.4: zugeordnete registrierte Member und Owner dürfen Kategorien ihres Accounts erstellen; keine pauschale Erweiterung anderer Rechte.
- AUTH-001/002 sind Implementierungs-/Nachweisaufgaben, kein bereits gelöster Schutz. H08/E09 und Recurrence-Domainnachweise separat führen; Plattformtests ersetzen keine späteren Domain-/HTTP-Tests.

## Verbrauch messen und nachjustieren

Ab jetzt für die nächsten drei vergleichbaren Schritte eine Ausgangsmessung festhalten; abgeschlossene Schritte nicht zur Messung erneut ausführen. Für H03 keine Verbrauchswerte rückwirkend erfinden; für einen bereits laufenden H04 nur verfügbare Teilwerte erfassen. Pro Lauf: Tool/Modell, Schritt, SHA/Dirty, verfügbare Input-/Output-/Cached-/Reasoning-Tokens, Dauer, Korrekturschleifen, Ergebnis und Messquelle. Nicht verfügbare Werte als `unbekannt` markieren. Zeichenanzahl ist nur Kontextgrößenindikator, keine Tokenmessung. Copilot-Abrechnungseinheiten nicht mit Tokens gleichsetzen; ohne vergleichbare Tokenanzeige getrennt auswerten.

Kennzahl: Summe tatsächlich gemessener Tokens einschließlich Korrekturen und Review je abgenommenem Schritt. Zusätzlich Fehlerrate und Nacharbeit beobachten. Nur ähnlich große Aufgaben vergleichen, keine H00-Inventur gegen komplexe Writer-Integration. Preisberechnung nur mit aktuell verifizierten Preisen; dieser Plan legt keine Modellpreise fest.

Empfohlene Arbeitsbudgets, keine harten Abbruchlimits: GO-Prompt etwa 100–250 Wörter, Übergabe etwa 300–500 Wörter, Schlussbericht etwa 200–400 Wörter plus Beleglinks. Wird ein Budget überschritten, Pflichtnachweise trotzdem vollständig sichern. Neue Session an einer sauberen Schrittgrenze, wenn Alt-Kontext die aktuelle Aufgabe überlagert; innerhalb eines Schritts bei nützlichem Kontext bleiben. Keine parallelen Implementierer standardmäßig starten; vorgeschriebene unabhängige Reviews gezielt beauftragen. Ein Modellwechsel ist eine Nutzerentscheidung anhand gemessener Qualität und Verbrauch, kein Ersatz für passende Aufgabenabgrenzung.

## Dateien verwenden

- `AGENTS.md`: bestehende Codex-Projektregeln plus kurzer Verweis auf den sparsamen Arbeitsablauf. Keine neue automatisch geladene Langfassung.
- `.github/copilot-instructions.md`: bestehende Konventionen plus derselbe Einstieg. Kein zweiter Fachvertrag.
- `prompts.md`: kopierbare Aufträge und Berichtsvorlage; nur bei Bedarf laden.
- `leitfaden-ab-h03.md`: einfache Nutzeranleitung für die laufende Umsetzung; nicht bei jedem GO vollständig erneut laden.
- `source-index.md`: automatisch erzeugte lokale Hash-/Überschriften-Navigation, keine fachliche Abnahme.

Die ältere `.github/prompts/start-baustein.prompt.md` bleibt unverändert. Für diese drei Features die hier bereitgestellten GO-Prompts verwenden: Das ältere Template verlangt zusätzliche Scope-Bestätigung und enthält direkte App-Kommandos; diese nicht blind aus dem Workspace-Root übernehmen.

Offizielle Grundlagen für die Dateiplatzierung: [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [GitHub Copilot Repository Instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions). Die Einsparstrategie ist eine projektspezifische Empfehlung, keine zugesagte Produkteigenschaft. Anweisungsunterstützung hängt vom verwendeten Copilot-Client ab; beim Einstieg prüfen.
