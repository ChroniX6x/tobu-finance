# Einfach weiterarbeiten und dabei Tokens sparen

Stand 30.10.2026: **P00 ist laut deiner Rückmeldung abgeschlossen. H03 liegt bereits im PR. Ihr seid bei H04.** Du musst nicht von vorne anfangen. Der Dateiname bleibt für bestehende Links erhalten. Dieser Leitfaden bestätigt keinen Merge oder CI-PASS des H03-PRs.

## 1. Jetzt einmal im laufenden Chat umstellen

Nutze den vorhandenen Umsetzungschat, wenn sein Kontext noch hilfreich ist. Wenn du H04 jetzt beauftragen willst, kopiere diesen Text hinein:

```text
GO ausschließlich für H04 gemäß aktuellem Date/Month-Implementierungsplan.
P00 ist abgeschlossen, H03 liegt im PR. Wende ab jetzt
docs/agents/token-plan.md auf H04 an.
Nutze den vorhandenen Kontext und die bisherigen Berichte. Starte P00
oder H00–H03 nicht neu und lade unveränderte Quellen nicht komplett erneut.
Prüfe die vorhandenen H03-PR-/Testbelege und ob der benötigte H03-Code
im Ausgangsstand enthalten ist. PR bedeutet weder Merge noch CI-PASS.
Fehlende Abhängigkeiten konkret melden; keinen Merge oder Branchwechsel
daraus ableiten. Lies H04 und seine Pflichtverweise vollständig.
Setze nur H04 inklusive Tests und vorgeschriebenem Review um.
Erstelle zum Abschluss docs/agents/runs/H04.md als kompakte Übergabe
gemäß docs/agents/prompts.md. Verlinke vorhandene Test- und Reviewbelege;
fehlende Belege offen benennen. Danach STOP, kein H05.
```

Dieser kopierte Auftrag ist das einzelne H04-GO. Die jetzige Bitte um Dokumentanpassung führt H04 hier nicht aus. Falls H04 bereits läuft, stattdessen „Setze den bereits freigegebenen H04-Schritt fort“ verwenden.

Du musst keine ganzen Dokumente einfügen und keine Dateien manuell erstellen. Der ausführende Agent liest die Dateien und schreibt den Bericht. Die lokalen Featurequellen liegen weiterhin in `C:/Users/hoffm/Documents/DevProjects/tobu-finance-agent-docs`.

## 2. Vor dem nächsten GO kurz den Abschluss ansehen

Warte auf den H04-Abschluss. Prüfe diese fünf Punkte in der Antwort:

- Es steht wirklich **H04** dort und kein ungefragt begonnener Folgeschritt.
- **A** und **Q** stehen getrennt da: A betrifft die geforderten Anforderungen, Q die Qualitätsprüfungen; die genaue Definition liefert der jeweilige Featureplan.
- Ausgeführte Tests und notwendige Reviews haben Belege. „Sollte funktionieren“ ist kein Testnachweis.
- Offene Fehler, fehlende Testumgebung und nicht ausgeführte Prüfungen stehen ausdrücklich dabei.
- `docs/agents/runs/H04.md` enthält den aktuellen Übergabestand mit Branch, SHA und Dirty-Status. SHA ist die Commit-Kennung; Dirty bedeutet zusätzliche, noch nicht committete Änderungen.

Du musst die technischen Nachweise nicht selbst neu erstellen. Bei unklarer Abschlussantwort reicht:

```text
Ergänze nur den H04-Abschlussbericht: Was ist für A und Q tatsächlich
belegt, was fehlt noch und wo liegen die Belege? Keine Folgephase starten.
```

Bei FAIL oder BLOCKED nicht einfach H05 freigeben. Erst die offenen H04-Punkte klären. Ist dafür eine echte Entscheidung von dir nötig, soll der Agent den konkreten Grund nennen. Nicht aus Spargründen einen fehlgeschlagenen Test übergehen.

## 3. Danach H05 mit einem kurzen Auftrag starten

Wenn H04 und die Voraussetzungen nach dem verbindlichen Plan erfüllt sind, kopiere:

```text
GO ausschließlich für H05 gemäß aktuellem Date/Month-Implementierungsplan.
Lies docs/agents/token-plan.md und docs/agents/runs/H04.md.
Prüfe den aktuellen Code- und Quellenstand. Nutze vorhandenes belegtes
Onboarding; lies H05 und seine aktuellen Pflichtverweise vollständig.
Bearbeite nur H05 einschließlich seiner Pflichtnachweise und Review.
Keine Migration bestehender Datenbanken ohne gesonderte Freigabe.
Erstelle docs/agents/runs/H05.md mit A/Q und Belegen; danach STOP.
```

Die fachlichen Regeln stehen bereits in den Quellen. Du musst sie nicht jedes Mal nacherzählen. Ein kurzes GO spart nur dann Arbeit, wenn der Bericht und die Pflichtquellen tatsächlich verfügbar sind.

## 4. Für jeden weiteren Schritt dieselbe Schleife nutzen

**Auftrag → Umsetzung → Tests/Review → Bericht lesen → nächstes einzelnes GO.**

Nach H04 folgen H05, H06, H07 und H08 mit ihren jeweiligen Voraussetzungen. H08 enthält das unabhängige Negativreview. Danach wird die Activity-Plattform E00–E09 gemäß Vertrag einzeln bearbeitet beziehungsweise vorhandener Fortschritt integriert. Bereits belegte Schritte nicht pauschal wiederholen. Die späteren Buchungsvorlagen-Schritte richten sich nach dem Detailplan; P00 bleibt abgeschlossen. H08-/E09-Nachweise und P04-Kontozeitzonen-Gates dürfen nicht übersprungen werden.

Für Folgeaufträge brauchst du nur zwei Angaben auszutauschen:

```text
GO ausschließlich für [NÄCHSTE SCHRITT-ID] gemäß aktuellem Featureplan.
Nutze docs/agents/token-plan.md und den letzten Bericht
docs/agents/runs/[VORHERIGE SCHRITT-ID].md.
Prüfe Voraussetzungen, SHA/Dirty und Quellenänderungen. Lies den
Schritt und seine Pflichtverweise vollständig; keine Gesamtdumps.
Setze nur diesen Schritt inklusive Pflichtprüfungen und Review um.
Schreibe docs/agents/runs/[NÄCHSTE SCHRITT-ID].md mit A/Q und Belegen.
Danach STOP bis zu meinem nächsten ausdrücklichen GO.
```

Eckige Klammern vor dem Absenden ersetzen, z. B. nächste ID `H05`, vorherige ID `H04`. Dieser Prompt erlaubt keine Migration bestehender Datenbanken, keinen Push, Merge oder Deploy.

## 5. Einen neuen Chat nur mit Übergabe beginnen

Nicht für jede kleine Korrektur einen neuen Chat eröffnen. Bleibe innerhalb eines Schritts im bestehenden Chat. An einer abgeschlossenen Schrittgrenze kannst du wechseln, besonders wenn der Chat schon sehr lang geworden ist. Dann den GO-Prompt aus Schritt 4 mit dem letzten Bericht verwenden. Ein neuer Chat ist nicht automatisch billiger: Fehlendes Onboarding kann erneutes vollständiges Lesen verlangen.

Wenn du mitten in H04 wechseln musst, lass zuerst im alten Chat eine Zwischenübergabe schreiben:

```text
Sichere den tatsächlichen H04-Zwischenstand in docs/agents/runs/H04.md:
bisher erledigt, noch offen, vorhandenes GO, Quellen-/Onboarding-Nachweis,
Branch/SHA/Dirty und Testbelege. Unfertiges nicht als PASS kennzeichnen.
Keine zusätzliche Implementierung allein für diese Übergabe.
```

Im neuen Chat dann:

```text
Setze den bereits ausdrücklich freigegebenen H04-Schritt fort.
Lies AGENTS.md, docs/agents/token-plan.md und docs/agents/runs/H04.md.
Prüfe Abweichungen zum Übergabestand. Nutze belastbar belegtes Onboarding;
fehlende Pflichtlektüre nachholen. Arbeite nur die offenen H04-Punkte ab.
Aktualisiere den Bericht und liefere A/Q mit Belegen; danach STOP.
```

Ein Wechsel von Codex zu Copilot funktioniert ebenso über Dateien statt über Kopieren des ganzen Chats. Arbeite pro Schritt mit einem ausführenden Agenten; ein vorgeschriebener unabhängiger Reviewer bleibt zusätzlich nötig.

## 6. Was du bei Codex und Copilot konkret tun musst

Öffne das Repository `tobu-finance` als Arbeitsprojekt. Die bestehenden `AGENTS.md`- und `.github/copilot-instructions.md`-Dateien enthalten den Einstieg in den Sparplan. Du brauchst keine weitere lange persönliche Anweisung zu hinterlegen. Falls der Agent den Plan noch nicht kennt, verweise im Auftrag ausdrücklich auf `docs/agents/token-plan.md`, wie in den Vorlagen.

Für lokale Nutzung muss der Agent den Nachbarordner mit den Featureplänen lesen können. Cloud-Copilot auf GitHub kann deinen lokalen Windows-Pfad nicht lesen. Nutze bis zur tatsächlichen Bereitstellung der vollständigen Pflichtquellen einen lokalen Agenten; ein Link auf den Windows-Pfad im Cloud-Prompt genügt nicht. Keine Featurearbeit aus einer verkürzten Zusammenfassung ableiten.

Die ältere Vorlage `.github/prompts/start-baustein.prompt.md` für diesen Ablauf nicht zusätzlich starten. Verwende die obigen Prompts, damit nicht parallel ein zweiter Einstiegsprozess mit erneuten Scope-Fragen läuft.

## 7. Woran du merkst, dass der Sparplan eingehalten wird

| Gut | Korrektur, wenn es anders läuft |
| --- | --- |
| Kurzer Auftrag mit ID und letztem Bericht | Keine kompletten Featurepläne in jeden Prompt kopieren. |
| Agent liest relevante Quellenabschnitte und Code gezielt | „Nutze den vorhandenen Quellenstand; begründe, welche erneute Volllektüre erforderlich ist.“ |
| Chat zeigt Testergebnis und relevante Fehler; volle Logs liegen als Beleg vor | „Verlinke vollständige Logs und zeige hier nur die Zusammenfassung und nötige Fehlerstellen.“ |
| Bericht hält den echten Stand statt der Chatgeschichte fest | „Aktualisiere die kompakte Übergabe, ohne unsere Unterhaltung zu duplizieren.“ |
| Nach Abschluss wartet der Agent | Kein „Mach direkt alle restlichen Schritte“ senden; Einzel-GOs beibehalten. |

Kurze Ausgabe allein beweist keine geringere Tokenzahl. Wenn dein Tool Verbrauchswerte anzeigt, notiere sie nach dem Schritt oder gib sie dem Agenten für den Bericht. Ohne Anzeige bleibt der Wert `unbekannt`; keine Zahlen schätzen. Falls H04 bereits läuft, sind neu erfasste Werte nur Teilverbrauch. Vergleiche später ähnliche Schritte einschließlich Fehlerbehebung und Review.

**Dein nächster Handgriff:** Den H04-Prompt aus Schritt 1 im Umsetzungschat senden. H03 bleibt im PR; sein benötigter Code und die Belege müssen für H04 verfügbar sein. Nach H04 kommt das eigene GO für H05.
