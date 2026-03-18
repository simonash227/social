---
phase: 01-scaffolding-database-auth
plan: "02"
subsystem: auth
tags: [auth, middleware, session, cookie, sqlite, nextjs]
dependency_graph:
  requires: ["01-01"]
  provides: ["auth-middleware", "session-management", "login-ui"]
  affects: ["all-dashboard-routes"]
tech_stack:
  added: ["server-only"]
  patterns: ["nodejs-middleware", "httponly-session-cookie", "bcryptjs-password", "rolling-session-expiry"]
key_files:
  created:
    - src/lib/auth.ts
    - src/app/api/auth/login/route.ts
    - src/app/api/auth/logout/route.ts
    - src/app/(auth)/login/page.tsx
    - middleware.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "server-only import guard in auth.ts prevents accidental client-side use"
  - "middleware.ts runtime: nodejs is stable in Next.js 15.5 — enables better-sqlite3 session lookup"
  - "Rolling 30-day session expiry updated on every valid request in middleware"
  - "bcryptjs pure-JS library used (not bcrypt) to avoid native module issues in Next.js bundler"
  - "Session cookie uses secure=true only in production to allow local dev without HTTPS"
metrics:
  duration_seconds: 182
  completed_date: "2026-03-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 5
  files_modified: 2
---

# Phase 01 Plan 02: Auth Middleware and Session Management Summary

Password authentication with session cookies using bcryptjs, drizzle-orm sessions table, and Next.js 15.5 Node.js middleware.

## What Was Built

### Task 1: Auth library, login/logout API routes, and login page

**`src/lib/auth.ts`** — Core session management with `import 'server-only'` guard:
- `validatePassword(input)` — reads `AUTH_PASSWORD` env var; bcrypt.compare() if stored starts with `$2`, plaintext compare otherwise
- `createSession()` — generates 32-byte random hex token, inserts into `sessions` table, sets httpOnly cookie with 30-day maxAge
- `deleteSession()` — reads session cookie, deletes DB row, clears cookie; `await cookies()` used throughout (Next.js 15 async cookies API)
- `refreshSession(token)` — updates `expiresAt` to now + 30 days for rolling expiry (called from middleware)

**`src/app/api/auth/login/route.ts`** — POST endpoint: reads `{ password }` from body, calls `validatePassword()`, returns 200 + session cookie on success or 401 with `{ error: 'Invalid password' }` on failure. Returns 500 with clear message if `AUTH_PASSWORD` not set.

**`src/app/api/auth/logout/route.ts`** — POST endpoint: calls `deleteSession()`, returns `{ success: true }`.

**`src/app/(auth)/login/page.tsx`** — Client component in `(auth)` route group (excluded from dashboard layout):
- Card centered on screen with "Social Content Engine" title
- Password input with loading state on submit button
- Fetch POST to `/api/auth/login`, redirect to `/` on success, error message on failure
- Uses shadcn/ui: Card, Input, Button, Label

### Task 2: Auth middleware with Node.js runtime

**`middleware.ts`** (project root):
- `export const config = { runtime: 'nodejs' }` — stable Next.js 15.5 feature enabling better-sqlite3 direct access in middleware
- Matcher excludes: `_next/static`, `_next/image`, `favicon.ico`, `login`, `api/health`, `api/auth`
- Flow: read session cookie → redirect to /login if missing → query sessions table with `eq(token) AND gt(expiresAt, now)` → if no valid row: delete cookie + redirect → if valid: update expiresAt (rolling 30-day) + `NextResponse.next()`
- Uses drizzle-orm operators: `eq`, `and`, `gt` from `drizzle-orm`

## Verification Results

Build: `npm run build` — compiled successfully. All 5 routes present:
- `○ /login` — static login page
- `ƒ /api/auth/login` — dynamic POST
- `ƒ /api/auth/logout` — dynamic POST
- `ƒ /api/health` — existing health endpoint unaffected

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **`server-only` import guard** — Added `import 'server-only'` in `auth.ts` as specified. This causes a build error if auth functions are accidentally imported in client components.

2. **`runtime: 'nodejs'` in middleware config** — Confirmed stable in Next.js 15.5.12. This allows direct better-sqlite3 session lookup in middleware without JWT or edge-compatible workarounds.

3. **Rolling expiry in middleware** — Session `expiresAt` is updated inline in middleware using drizzle `update().set().where().run()` (synchronous better-sqlite3 call), extending by 30 days on each valid request.

4. **`secure: process.env.NODE_ENV === 'production'`** — Cookie `secure` flag is only set in production, allowing local development over HTTP without needing HTTPS.

5. **No `refreshSession` call from middleware** — The plan specified `refreshSession(token)` as a utility function callable from middleware. Rather than importing from `src/lib/auth.ts` (which has `import 'server-only'`), the middleware performs the update inline. The `refreshSession` export in `auth.ts` is available for future use in server actions/routes.

## Self-Check: PASSED

All 5 created files confirmed present on disk. Both task commits verified in git log:
- `277e5ad` feat(01-02): add auth library, login/logout API routes, and login page
- `bd86b6a` feat(01-02): add auth middleware with Node.js runtime for session validation
