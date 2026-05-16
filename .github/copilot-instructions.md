# ToBu Finance – Copilot-Rahmenbedingungen

## Projekt-Überblick

ToBu Finance ist eine Haushalts-App mit Angular 21 Frontend (`tobu-finance/`) und Express.js/Mongoose Backend (`tobu-finance-api/`).

- **Frontend:** Angular 21 (zoneless/signal-basiert), NGXS State, PrimeNG v21, Tailwind CSS
- **Backend:** Express.js, Mongoose/MongoDB, Zod-Validierung, JWT-Auth
- **Pfad-Alias:** `@/` → `src/app/`

---

## Prozess-Regeln (kritisch)

### Phasen & Commits
- **Immer nur eine Phase (Baustein) pro Session implementieren** — nie zwei auf einmal ohne explizite Aufforderung
- Jede Phase endet mit einem commit-bereiten Zustand bevor die nächste beginnt
- Nach jeder Phase muss ein **unabhängiges Sub-Agenten-Review** stattfinden (Details siehe Abschnitt Review)
- Bei Unklarheiten oder Designentscheidungen **immer zuerst den User fragen** — nie eigenständig annehmen

### Rückfragen
- Designentscheidungen (Farbe, Layout, UX-Flow, Namensgebung) → immer rückfragen
- Wenn eine Anforderung mehrere Interpretationen hat → rückfragen
- Wenn ein Baustein-Scope unklar ist → Taskliste lesen und Scope bestätigen lassen

---

## Angular Frontend – Coding-Konventionen

### Pflicht bei jeder Komponente
- `ChangeDetectionStrategy.OnPush` immer setzen
- Standalone Components (kein NgModule)
- Signale (`signal()`, `computed()`) für lokalen State — keine direkten Properties
- `select()` Shorthand von NGXS für Store-Selectors
- `inject()` statt Constructor-Parameter für Dependency Injection
- `takeUntilDestroyed()` für alle Subscriptions

### Angular-Features
- Immer neueste Angular-Features nutzen: `@if`, `@for`, `@switch` (keine `*ngIf`, `*ngFor`)
- `input()`, `output()` Signal-API für Component-Inputs/Outputs
- Lazy Loading: `loadComponent` für einzelne Seiten, `loadChildren` für Sub-Route-Dateien

### PrimeNG
- **Immer PrimeNG-Komponenten bevorzugen** wenn verfügbar (Button, Input, Select, Dialog, Sidebar, etc.)
- PrimeNG Standalone-Import-Stil (kein PrimeNGModule)
- Für Toasts: `MessageService` aus `primeng/api`, `p-toast` in Shell-Komponente

### Theming – Dark/Light Mode
- **Immer beide Modi berücksichtigen** — nie nur einen Modus testen/implementieren
- CSS-Klassen aus PrimeNG-Theme-System verwenden: `text-color`, `text-muted-color`, `bg-surface-card`, `border-surface`, `text-primary`
- Keine hardcodierten Hex-Farben oder `text-gray-*` für UI-Elemente — immer semantische Theme-Tokens
- Tailwind nur für Layout/Spacing, semantische Farben via PrimeNG-Tokens

### State (NGXS)
- `provideStates([XyzState])` auf Route-Ebene, nie global in `app.config.ts`
- State-Dateien: `state/xyz.state.ts`, `state/xyz.actions.ts`
- Pattern: `LoadXyz(accountId)` → API-Call → `tap(vm => patchState)` → `catchError` → EMPTY
- `cancelUncompleted: true` bei Load-Actions die häufig neu getriggert werden
- Kein optimistisches Speichern: immer Serverantwort abwarten, dann `ReloadXyz()` + Toast

### Routing
- `accountId` liegt auf dem Grandparent-Route → immer via `pathFromRoot` lesen:
  ```ts
  const accountId = this.route.snapshot.pathFromRoot
    .map(r => r.params['accountId'])
    .find(id => !!id);
  ```
- `data: { breadcrumb: 'Name' }` bei jeder neuen Route setzen

### Layout-Pattern (Desktop/Mobile)
- Desktop: 2-Spalten — sticky Sekundärnavigation links (140-180px) + Inhaltsbereich rechts
- Mobile: `p-accordion` mit `[multiple]="true"` für alle Sektionen
- Breakpoint: `(max-width: 767px)` via `BreakpointObserver`
- Section-IDs folgen dem Muster `{page}-{section}-section` für IntersectionObserver/Scroll

### API-Service
- `API_BASE_URL` Token via `inject(API_BASE_URL)` — nie hardcodierte URLs
- HTTP-Methoden immer typisiert: `this.http.get<ResponseType>(...)`

---

## Datenkonventionen

- **Geldwerte:** immer als `amountMinor` (Integer, Minor Units / Cent) — UI zeigt Euro
- **Monate:** immer als `YYYY-MM` String — API akzeptiert `YYYY-MM`, Backend persistiert als Date (Month-Anchor)
- **Backend TypeScript:** Imports mit `.js`-Extension (`import { X } from './file.js'`)
- **IDs:** MongoDB ObjectId als `string` im Frontend

---

## Kompilierung & Qualitätssicherung

### Nach jeder Implementierung prüfen
1. `npx tsc --noEmit` → muss 0 Fehler zeigen
2. `npx ng build --configuration development` → muss 0 Fehler zeigen
3. Bei Template-Fehlern: Angular-Build zeigt mehr als `tsc` allein

---

## Sub-Agenten-Review (nach jeder Phase)

Nach Abschluss einer Phase **muss** ein unabhängiger Sub-Agent-Review stattfinden:

- Sub-Agent bekommt: Baustein-Scope, alle betroffenen Dateien, Konzept-Referenz
- Sub-Agent prüft:
  1. Korrekte Umsetzung der Baustein-Anforderungen
  2. Einhaltung aller Angular-Patterns (OnPush, Standalone, Signals, etc.)
  3. Kompilierbarkeit (TypeScript + Angular Templates)
  4. Dark/Light Mode-Kompatibilität (semantische Theme-Tokens?)
  5. Vollständigkeit des Baustein-Scopes
  6. Übereinstimmung mit dem Konzept
- Gefundene Fehler werden **vor dem Commit** behoben
- Gesamturteil: ✅ Bereit für Commit / ⚠️ Kleinere Fixes / ❌ Kritische Fehler

---

## Konzept- & Implementierungsdokumente

- Konzept Planung-Page: `tobu-finance-api/docs/impl_doc/planning/to_bu_planung_page_konzept_v_1.md`
- Taskliste Planung-Page: `tobu-finance-api/docs/impl_doc/planning/ToBu_Planung_Taskliste_Agent_Ready.md`
- Referenz-Implementierung Layout: `src/app/accounts/account-management/master-data/master-data-page.component.ts`
- Referenz-Implementierung State: `src/app/accounts/account-management/master-data/state/master-data-page.state.ts`
