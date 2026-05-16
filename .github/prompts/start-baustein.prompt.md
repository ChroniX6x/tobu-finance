---
description: "Startet einen neuen Baustein für ein Feature. Liest Taskliste/Konzept, bestätigt den Scope, fragt bei Unklarheiten nach, und beginnt dann mit Task 1 des Bausteins."
argument-hint: "Baustein-Nummer und optional Pfade zu Taskliste/Konzept (z.B. '2 – path/to/tasklist.md')"
---

# Baustein starten

Du startest jetzt **Baustein $args**.

## Pflicht-Schritte vor der Implementierung

1. **Taskliste und Konzept lokalisieren:**
   - Wenn der User Pfade zu Taskliste und/oder Konzept-Dokument mitgegeben hat → diese lesen
   - Andernfalls den User fragen: *„Wo liegt die Taskliste / das Konzept-Dokument für diesen Baustein?"*
   - Lies den relevanten Baustein-Abschnitt vollständig durch

2. **Frage den User** bevor du anfängst:
   - Zeige eine kurze Zusammenfassung: welche Tasks, welche Dateien werden erstellt/geändert
   - Frage ob der Scope so korrekt ist
   - Frage bei Designentscheidungen (Layout, Farben, UX) explizit nach

3. Stelle sicher, dass der vorherige Baustein committed wurde — falls nicht, weise den User darauf hin.

## Rahmenbedingungen während der Implementierung

- **Nur diesen einen Baustein** implementieren — kein Vorgriff auf den nächsten
- Dark/Light Mode: ausschließlich semantische PrimeNG Theme-Tokens verwenden (`text-color`, `text-muted-color`, `bg-surface-card`, etc.)
- Neueste Angular-Features: `@if`/`@for`, Signal-Inputs, `inject()`, `select()`, `takeUntilDestroyed()`
- PrimeNG immer bevorzugen wenn eine passende Komponente existiert
- Nach jeder erstellten/geänderten Datei: kurz validieren ob der Import-Pfad stimmt

## Pflicht-Schritte nach der Implementierung

1. `npx tsc --noEmit` ausführen → muss 0 Fehler zeigen
2. `npx ng build --configuration development` → muss 0 Fehler zeigen
3. Sub-Agenten-Review starten (`konzept-reviewer` Agent):
   - Übergib: Baustein-Scope, alle betroffenen Dateien, Pfad zu Konzept/Taskliste
   - Gefundene Fehler **vor dem Commit** beheben
4. Commit-bereiten Zustand bestätigen und den User informieren

## Wiederkehrende Referenzen (projektspezifisch)

- Layout-Referenz: `src/app/accounts/account-management/master-data/master-data-page.component.ts`
- State-Referenz: `src/app/accounts/account-management/master-data/state/master-data-page.state.ts`
