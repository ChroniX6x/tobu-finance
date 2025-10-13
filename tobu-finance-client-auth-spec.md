
# ToBu‑Finance – Client Auth Integration Spec (JWT RS256, Access+Refresh)

**Purpose:** This document precisely describes what the client must implement so the application interoperates with the server-side authentication you set up (RS256 JWT access tokens + refresh via httpOnly cookie). It intentionally avoids framework-specific code and concrete component examples. All steps are written as implementation requirements that a coding agent can follow to integrate into an existing frontend codebase (e.g., Angular, React, Vue).

---

## 1) Model & Terminology

- **Access Token (JWT, RS256):** short‑lived credential carried in the `Authorization: Bearer <token>` header. Contains minimal claims (`sub`, `roles`, `email`, `type:"access"`). *Never* store persistently (no Local/SessionStorage).
- **Refresh Token (JWT, RS256):** long‑lived credential stored **only as httpOnly cookie** with `Path=/api/auth/refresh`. Never read by JS. Used **only** to obtain a new access token.
- **Session (server‑side):** DB record linked to a refresh token `jti`. Server rotates sessions on refresh and performs reuse detection.

---

## 2) Server Endpoints (Contract)

The client **must** call these endpoints exactly as specified:

1. `POST /api/auth/register`  
   - Request: `{ email, password, name? }` (JSON).  
   - Response: `{ accessToken, user }` (JSON).  
   - Cookie: none required.
2. `POST /api/auth/login`  
   - Request: `{ email, password }` (JSON).  
   - Response: `{ accessToken, user }` (JSON).  
   - Cookie: none required.
3. `POST /api/auth/refresh`  
   - Request: empty JSON body `{}`.  
   - **withCredentials: true** (must send cookies).  
   - Response: `{ accessToken }` (JSON).  
   - Cookie: server reads/writes the httpOnly refresh cookie (client JS never touches it).
4. `POST /api/auth/logout`  
   - Request: empty JSON body `{}`.  
   - **withCredentials: true**.  
   - Response: `204 No Content`.
5. Any protected API (e.g., `/api/...`)  
   - Request: include `Authorization: Bearer <accessToken>`.  
   - Response: application data.  
   - On `401`, client **must** execute the refresh algorithm (see §4).

**CORS & Cookies:** The client must send `withCredentials: true` **only** for `/api/auth/refresh` and `/api/auth/logout`. All other requests must not include credentials by default unless explicitly required.

---

## 3) Storage & Security Requirements

- **Access token:**
  - Keep **in memory** only (e.g., store variable, in‑memory store, signal, or redux‑like state).
  - Do **not** persist to LocalStorage, SessionStorage, IndexedDB, cookies, or URL.
  - Provide a single read accessor for the current token; return `null` if absent.
- **User object (optional):**
  - May be cached in memory (optionally in SessionStorage *without* token). Not strictly required for auth to work.
- **Refresh token:**
  - Never handled by client code; it lives in an httpOnly cookie controlled by the server.

---

## 4) HTTP Layer – Interceptor Algorithm

Implement a single global HTTP request interceptor with the following behavior:

**Before request:**
1. Detect if the request URL targets the API origin (e.g., `apiBaseUrl`) and is **not** an auth endpoint (`/api/auth/*`).
2. If an access token is present in memory, set `Authorization: Bearer <token>` on the request.
3. Do **not** attach cookies except in the explicit refresh/logout calls.

**On response error (`401 Unauthorized`):**
1. If the failing request is an auth endpoint (`/api/auth/*`), **do not** attempt refresh; propagate the error.
2. Otherwise execute the **Refresh Flow** (single‑flight; see §5) then retry the original request exactly once with the new access token.
3. If refresh fails or yields another `401`, clear the in‑memory session and surface a terminal auth error for the UI (see §8).

**Concurrency constraint:** The interceptor must implement a **single‑flight** mechanism to prevent parallel refresh calls (e.g., shared promise/lock/queue). All concurrent `401` retries must await the same refresh result.

---

## 5) Refresh Flow (Single‑Flight)

Pseudocode (framework‑agnostic):

```
global state: accessToken|null, refreshInFlight: Promise<string>|null

function ensureAccessTokenOrRefresh(): Promise<string> {
  if (accessToken != null) return Promise.resolve(accessToken)
  return refreshAccessToken()
}

function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = POST /api/auth/refresh withCredentials:true
    .then(res => {
      accessToken = res.accessToken
      return accessToken
    })
    .catch(err => {
      accessToken = null   // clear session token
      throw err
    })
    .finally(() => { refreshInFlight = null })
  return refreshInFlight
}
```

Retry rule: After obtaining a new token, repeat **one** failed request (idempotency is caller’s responsibility). Do not chain infinite retries.

---

## 6) Auth Service – Required Operations

Implement a service (name arbitrary) that exposes exactly these operations; do not couple them to the UI:

- `register({ email, password, name? }): Promise<User>`  
  Calls `/api/auth/register`; stores the returned `accessToken` in memory and returns `user`.
- `login({ email, password }): Promise<User>`  
  Calls `/api/auth/login`; stores `accessToken` and returns `user`.
- `refresh(): Promise<string>`  
  Calls `/api/auth/refresh` with `withCredentials:true`; stores and returns `accessToken`.
- `logout(): Promise<void>`  
  Calls `/api/auth/logout` with `withCredentials:true`; regardless of response, clears in‑memory token and user.
- `getAccessToken(): string|null`  
  Returns current token from memory (no persistence).
- `setAccessToken(token: string|null): void`  
  Allows the interceptor to update the token after refresh.
- (Optional) `getUser(): User|null`, `setUser(User|null): void`

The service must be free of UI concerns and must not directly navigate or display messages.

---

## 7) Route Protection (Guards)

- Provide a **route guard** that returns `true` if an access token exists, otherwise triggers a navigation/redirection to a public login route.
- Provide an optional **role guard** (`requireRole(role: string)`) that performs a simple `roles.includes(role)` check on the in‑memory user object. If the user is absent or the role check fails, redirect to a safe route.

These guards must be composable and independent of specific component implementations.

---

## 8) UI Behavior (Non‑Prescriptive)

- On successful login/register, transition to the first protected route (e.g., dashboard).  
- On terminal auth failures (refresh rejected, `401` on protected call after refresh), clear session state and route to the login page. Display a generic “Session expired” message (mechanism up to the host app).  
- Logout should be available in a global UI element; call the service’s `logout()` and then navigate to the login page.

No specific component structures or styles are mandated by this spec.

---

## 9) Configuration Requirements

- Provide a single config source (e.g., environment file) that defines:
  - `apiBaseUrl` (e.g., `http://localhost:4000`)
  - Optional: `apiPrefix` (e.g., `/api`)
- The interceptor must detect “auth endpoints” via URL pattern matching: requests whose path starts with `${apiPrefix}/auth/`.
- Only `/api/auth/refresh` and `/api/auth/logout` must be sent with `withCredentials:true` so that the refresh cookie is included. All other requests should not include credentials by default.

---

## 10) CORS & Cookies (Client‑Side Responsibilities)

- Ensure the HTTP client supports `withCredentials:true` on a per‑request basis (refresh and logout).
- Do not globally enable credentials for all requests.  
- If the frontend and backend run on different origins, ensure the browser is allowed to send cookies for the backend origin (no third‑party cookie block in dev setups).

---

## 11) Error Mapping

- Map **401** with failing refresh to a distinct **AUTH_EXPIRED** condition.  
- Map **403** to **AUTH_FORBIDDEN** for role‑guard decisions.  
- Do not leak raw server errors to the UI; surface domain‑meaningful states for the host app.

---

## 12) Telemetry (Optional but Recommended)

- Log a single “auth refresh attempted” event with success/failure results.  
- Debounce/log throttle to avoid noise during burst retries.

---

## 13) Testing & Acceptance Criteria (DoD)

Implement automated or manual checks covering at minimum:

1. **Happy path login:** `login()` stores token; protected call succeeds.
2. **Access token expiry:** first protected request after expiry yields `401`; interceptor refreshes; request is retried once and succeeds.
3. **Refresh denied (401):** interceptor clears session; navigation to login occurs; subsequent protected calls are prevented by the guard.
4. **Single‑flight refresh:** trigger multiple parallel protected calls after expiry; exactly **one** refresh request is sent; all calls are retried after the same refresh completes.
5. **Logout:** clears session, revokes refresh server‑side; protected routes become inaccessible until next login.
6. **Role guard:** route requiring a role rejects unauthorized users and navigates to a safe route.
7. **No persistent token storage:** verify that LocalStorage/SessionStorage/cookies do not contain the access token at any time.
8. **No credentials on non‑auth API calls:** verify that only refresh/logout send cookies (`withCredentials:true`).

A change is **done** when all of the above pass without manual intervention.

---

## 14) Angular‑Specific Adapter (Optional Implementation Notes)

If the host app is Angular (v17/18) using Signals and the new control flow:

- Provide a small **AuthStore** (Signals) with `accessToken`, `user`, `isAuthenticated`, `roles`. Store **only** the token in memory.
- Register a single **HTTP interceptor** via `provideHttpClient(withInterceptors([...]))` implementing §4–§5.
- Implement `authGuard` and `roleGuard` as standalone guards returning boolean or `UrlTree`.
- Ensure the **refresh** call is executed with `{ withCredentials:true }` (per‑request) and all other API calls are not.
- UI wiring (login form, header logout button) is not mandated; trigger `login()`, `logout()` and route transitions accordingly.

These notes are purely advisory; the normative behavior is defined in §§1–13.

---

## 15) Non‑Goals

- No guidance on design, styling, or specific component structures.  
- No persistence of access tokens.  
- No cross‑tab synchronization requirement.  
- No offline queueing behavior.

---

## 16) Minimal Pseudocode Summary

```
state: accessToken|null, user|null, refreshInFlight:Promise<string>|null

onEachRequest(req):
  if isApi(req) and not isAuthEndpoint(req) and accessToken:
    req.headers.Authorization = "Bearer " + accessToken

onResponseError(req, error):
  if status != 401 or isAuthEndpoint(req):
    throw error
  try:
    token = await refreshAccessTokenSingleFlight()
    retry req with Authorization: Bearer token
  catch:
    clearSession()
    signalAuthExpired()

function refreshAccessTokenSingleFlight():
  if refreshInFlight: return refreshInFlight
  refreshInFlight = http.post("/api/auth/refresh", {}, { withCredentials:true })
    .then(r => accessToken = r.accessToken)
    .finally(() => refreshInFlight = null)
  return refreshInFlight
```

---

**End of Spec**

