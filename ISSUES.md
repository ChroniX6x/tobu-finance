# Tobu Finance - Identifizierte Probleme

Stand: 6. Oktober 2025

## 🔴 Kritisch (Sofort beheben)

### 1. AccountDashboardState fehlt in Store-Registrierung
**Datei**: `src/app/app.config.ts`
**Problem**: State wird nicht initialisiert
**Fix**: Hinzufügen zu `provideStore([..., AccountDashboardState])`

### 2. Unsichere Member-Suche mit Non-Null Assertion
**Datei**: `src/app/dashboard/account-dashboard/account-dashboard.ts:27`
**Problem**: Runtime-Error wenn kein Member gefunden
**Fix**: Optional Chaining oder Default-Wert verwenden

### 3. Environment-Import existiert nicht
**Datei**: `src/app/account-dashboard/domain/account-overview-data.service.ts:4`
**Problem**: Compile-Error
**Fix**: Import entfernen (nicht verwendet)

### 4. Memory Leak - Unmanaged Subscription
**Datei**: `src/app/dashboard/account-dashboard/account-dashboard.ts:80`
**Problem**: Subscription wird nie aufgeräumt
**Fix**: `takeUntilDestroyed()` verwenden

## ⚠️ Hoch (Bald beheben)

### 5. Fehlende Error-Anzeige für User
**Dateien**: Mehrere State-Dateien
**Problem**: Errors werden nicht im UI angezeigt
**Fix**: Toast/Message-Service implementieren

### 6. Debug-Code in Produktion
**Dateien**: 
- `src/main.ts`
- `src/app/app.config.ts` (withDebugTracing)
- `src/app/wizard/state/wizard-data.service.ts`
- `src/app/calculation/calculation.ts`
**Problem**: Performance-Impact, Sicherheitsrisiko
**Fix**: Development/Production Guards

### 7. Hardcoded User-ID
**Datei**: `src/app/dashboard/account-dashboard/account-dashboard.ts:27`
**Problem**: Funktioniert nur für Test-User
**Fix**: AuthService implementieren

## 💡 Mittel (Refactoring)

### 8. Übermäßige Verwendung von `any` (15+ Vorkommen)
**Dateien**: 
- `src/app/state/route-initializer.ts`
- `src/app/core/layout/**/*.ts`
**Problem**: Keine Typsicherheit
**Fix**: Typen definieren

### 9. Duplizierte Formatierungslogik
**Dateien**:
- `account-dashboard.ts`
- `account-dashboard.state.ts`
**Fix**: Shared Utility-Funktion erstellen

### 10. Inkonsistentes Null-Handling
**Dateien**: Mehrere
**Fix**: Coding Guidelines definieren

## 📝 Niedrig (Nice-to-have)

### 11. Fehlende Tests
**Problem**: Nur 2 Test-Dateien vorhanden
**Fix**: Test-Coverage erhöhen

### 12. Commented-out Code
**Dateien**: 
- `src/app/calculation/calculation.ts:45-48`
**Fix**: Entfernen oder reaktivieren

### 13. Inkonsistente State-Patterns
**Problem**: Mix aus NGXS State und lokalen Signals
**Fix**: Architektur-Entscheidung dokumentieren

## 🔄 Vorgeschlagene Änderungen

1. **AccountDashboardState registrieren**
2. **currentMember() absichern**
3. **Environment-Import entfernen**
4. **Subscriptions aufräumen**
5. **Error-Handling verbessern**
6. **Debug-Code entfernen/schützen**
7. **AuthService implementieren**
8. **Type-Safety verbessern**
9. **Shared Utilities erstellen**
10. **Test-Coverage erhöhen**
