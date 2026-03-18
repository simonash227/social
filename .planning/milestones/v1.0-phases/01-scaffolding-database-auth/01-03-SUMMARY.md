---
phase: 01-scaffolding-database-auth
plan: "03"
subsystem: ui
tags: [nextjs, shadcn, tailwind, next-themes, dark-mode, sidebar, dashboard]

# Dependency graph
requires:
  - phase: 01-scaffolding-database-auth/01-01
    provides: shadcn/ui components (sidebar, badge, tooltip, dropdown-menu), lucide-react icons, next-themes installed
  - phase: 01-scaffolding-database-auth/01-02
    provides: auth middleware protecting all dashboard routes
provides:
  - Dashboard shell layout with shadcn sidebar, brand switcher, and top bar
  - Dark-only theme configuration via next-themes ThemeProvider
  - AppSidebar server component querying brands from DB
  - TopBar server component showing AI_MODE badge and system health dot
  - Home page placeholder at route /
affects:
  - All subsequent UI phases — every page renders inside this dashboard shell
  - Phase 2A (Brand Profiles) — brand switcher dropdown uses brands from DB
  - Phase 5 (Calendar) — calendar page uses /calendar route in sidebar nav

# Tech tracking
tech-stack:
  added: []
  patterns:
    - next-themes ThemeProvider dark-only (defaultTheme=dark, enableSystem=false)
    - suppressHydrationWarning on html tag prevents theme flash
    - shadcn sidebar with base-ui v4 render prop pattern (not asChild)
    - Server component queries DB directly for sidebar data

key-files:
  created:
    - src/components/theme-provider.tsx
    - src/components/app-sidebar.tsx
    - src/components/top-bar.tsx
    - src/app/(dashboard)/layout.tsx
    - src/app/(dashboard)/page.tsx
  modified:
    - src/app/layout.tsx

key-decisions:
  - "shadcn v4 uses base-ui under the hood -- DropdownMenuTrigger and TooltipTrigger do not accept asChild prop; use className prop directly instead"
  - "AppSidebar is a server component querying brands via getDb() at render time for the brand switcher"
  - "Old src/app/page.tsx deleted -- (dashboard)/page.tsx serves root path / via route group"
  - "Dark mode applied via html className='dark' + ThemeProvider to eliminate any light-mode flash"

patterns-established:
  - "Server components in sidebar use getDb() directly for data fetching"
  - "base-ui Trigger components accept className directly, no asChild prop"
  - "Dashboard layout pattern: SidebarProvider > AppSidebar + main > TopBar + children"

requirements-completed: [DASH-04]

# Metrics
duration: 8min
completed: 2026-03-16
---

# Phase 01 Plan 03: Dashboard Shell Summary

**Dark-only dashboard shell with shadcn v4 sidebar nav, brand switcher dropdown, AI_MODE badge, and system health indicator in top bar**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-16T07:42:30Z
- **Completed:** 2026-03-16T07:50:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- ThemeProvider wrapper with dark-only mode (no light toggle, no hydration flash)
- Dashboard shell layout serving all authenticated pages via (dashboard) route group
- AppSidebar server component with 5 nav items, brand switcher querying DB at render time
- TopBar showing AI_MODE badge (green=testing, orange=production) and green health dot with tooltip

## Task Commits

1. **Task 1: Create theme provider and configure dark-only root layout** - `b4b08c2` (feat)
2. **Task 2: Build dashboard shell with sidebar, brand switcher, and top bar** - `0aa25f6` (feat)

## Files Created/Modified

- `src/components/theme-provider.tsx` - Client wrapper around next-themes ThemeProvider
- `src/app/layout.tsx` - Root layout with Inter font, suppressHydrationWarning, ThemeProvider dark-only
- `src/components/app-sidebar.tsx` - Server component: 5 nav items, brand switcher dropdown via DB query
- `src/components/top-bar.tsx` - Server component: AI_MODE badge, system health dot with tooltip
- `src/app/(dashboard)/layout.tsx` - Dashboard layout: SidebarProvider wrapping AppSidebar + TopBar + children
- `src/app/(dashboard)/page.tsx` - Placeholder home page with welcome cards and setup instructions

## Decisions Made

- shadcn v4 uses base-ui under the hood. `DropdownMenuTrigger` and `TooltipTrigger` do not accept `asChild` prop (unlike Radix-based shadcn v3). Used `className` prop directly on the trigger elements.
- `AppSidebar` is a server component that calls `getDb()` directly to fetch brands for the switcher dropdown. No separate API route needed.
- The old `src/app/page.tsx` was deleted because `(dashboard)/page.tsx` serves the same root path `/` via the Next.js route group mechanism.
- Dark mode applied via `className="dark"` on the html element plus ThemeProvider to eliminate any potential light-mode flash on page load.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed asChild prop from base-ui Trigger components**
- **Found during:** Task 2 (dashboard shell build, npm run build type check)
- **Issue:** Plan suggested using `asChild` pattern (Radix-ui convention) but shadcn v4 uses base-ui which does not support `asChild` on Trigger components
- **Fix:** Removed `asChild` from `DropdownMenuTrigger` and `TooltipTrigger`, applied `className` directly to the trigger element
- **Files modified:** src/components/app-sidebar.tsx, src/components/top-bar.tsx
- **Verification:** `npm run build` passes without type errors
- **Committed in:** 0aa25f6 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug - base-ui API incompatibility)
**Impact on plan:** Essential fix for TypeScript compilation. No scope creep. shadcn v4 base-ui pattern used consistently.

## Issues Encountered

- `DropdownMenuTrigger asChild` failed TypeScript check because base-ui Menu.Trigger doesn't accept `asChild`. Resolved by using className prop directly on trigger element.
- `TooltipTrigger asChild` similarly failed. Resolved same way.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard shell complete and building successfully
- All authenticated pages will render inside the sidebar + top bar shell
- Brand switcher will populate when brands are added (Phase 2A)
- AI_MODE badge reads from env var, defaults to 'testing'
- Routes /brands, /calendar, /activity, /settings are linked in nav but pages don't exist yet (built in later phases)

---
*Phase: 01-scaffolding-database-auth*
*Completed: 2026-03-16*
