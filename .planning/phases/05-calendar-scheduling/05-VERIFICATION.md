---
phase: 05-calendar-scheduling
verified: 2026-03-18T10:30:00Z
status: human_needed
score: 12/12 must-haves verified
human_verification:
  - test: "Visit /calendar, verify month view renders as default with FullCalendar grid"
    expected: "Month calendar grid renders with dark theme, days visible, no white FullCalendar chrome"
    why_human: "Visual rendering cannot be verified programmatically"
  - test: "Click 'week' button in calendar toolbar"
    expected: "Week view with hourly time slots appears; 'month' button switches back"
    why_human: "FullCalendar view switching is a runtime DOM interaction"
  - test: "If any post exists in scheduled/published/failed status, verify events appear with colored platform dots and status icons (checkmark/clock/X)"
    expected: "Events show truncated title, 6px colored circle per platform, status icon"
    why_human: "Event rendering quality requires visual inspection"
  - test: "Drag a scheduled event to a different day on the calendar"
    expected: "Event snaps to new day; on release, DB scheduled_at updates; revert works on network error"
    why_human: "Drag-and-drop is a real-time user interaction requiring browser testing"
  - test: "Select a brand via brand filter (?brand=ID), then click 'Configure Schedule' toggle (?schedule=1)"
    expected: "SlotConfig panel appears below calendar; add a time slot (e.g. 09:00), click Save Schedule, refresh page — slot persists"
    why_human: "Persistence requires a live DB write and page reload to verify"
  - test: "Verify the draft posts panel shows unscheduled drafts; click Schedule on one"
    expected: "Post gets scheduled 1 hour from now; calendar event appears after refresh"
    why_human: "Requires live draft data and DB state change"
  - test: "Check server console log for '[cron] Jobs registered (publish, backup, ai-spend-summary)' on startup"
    expected: "Log line confirms all three jobs including publish registered"
    why_human: "Cron startup requires running the server"
  - test: "Set a post scheduled_at to 1 minute in the past in the DB, wait for cron tick, check post status"
    expected: "Post status changes to published (or failed if no Upload-Post account); activity log entry created"
    why_human: "Auto-publish pipeline requires live cron execution and Upload-Post integration"
  - test: "Verify FullCalendar dark mode: no white/light backgrounds visible on the calendar page"
    expected: "All calendar chrome (toolbar, day headers, day numbers, today highlight) uses dark theme"
    why_human: "Dark mode visual quality requires browser inspection"
---

# Phase 05: Calendar Scheduling Verification Report

**Phase Goal:** Content calendar visualization and automated publishing with smart scheduling.
**Verified:** 2026-03-18T10:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Posts with scheduled_at in the past are auto-published via Upload-Post every minute | VERIFIED | `cron.ts:17` schedules `* * * * *` with dynamic import of `publishDuePosts`; `publish.ts:28-35` queries `posts WHERE status='scheduled' AND scheduledAt <= now` |
| 2 | Failed platform publishes retry up to 3 times with 5-minute backoff | VERIFIED | `publish.ts:134-148` increments `failureCount`, sets `retryAt = now + 5min` if `failureCount < 3`; `MAX_FAILURES = 3` constant at line 8 |
| 3 | After 3 failures on all platforms, post status becomes failed | VERIFIED | `publish.ts:137-141` sets `status='failed'` when `newFailureCount >= MAX_FAILURES`; `processPost:81-86` sets post status='failed' when all platforms are failed |
| 4 | Scheduling slots can be configured per brand per platform | VERIFIED | `schedulingSlots` table in schema.ts with brandId+platform+hour+minute; `saveSchedulingSlots` server action (delete-all + bulk insert); SlotConfig UI component with add/remove per platform |
| 5 | Scheduled posts receive +/-15 min jitter on their scheduled_at time | VERIFIED | `schedule.ts:140-141` applies `jitterMs = (Math.random() * 30 - 15) * 60 * 1000` before setting scheduledAt |
| 6 | User can view scheduled and published posts in a month calendar grid | VERIFIED | `calendar-view.tsx:101-116` renders FullCalendar with dayGridPlugin, initialView='dayGridMonth'; `getCalendarEvents` returns posts with status in ['scheduled','published','failed'] |
| 7 | User can switch between week and month views | VERIFIED | `calendar-view.tsx:104-109` sets headerToolbar with `right: 'dayGridMonth,timeGridWeek'`; timeGridPlugin installed |
| 8 | User can drag an event to a new date and scheduled_at updates in DB | VERIFIED | `calendar-view.tsx:84-98` handles eventDrop, extracts postId+newStart, calls `reschedulePost(postId, newStart.toISOString())`; reverts on error |
| 9 | Calendar events show platform color coding and status indicators | VERIFIED | `calendar-view.tsx:11-27` defines PLATFORM_COLORS and STATUS_ICONS maps; `renderEventContent:29-77` renders 6px colored platform dots and status icon per event |
| 10 | User can configure posting time slots per brand per platform | VERIFIED | SlotConfig (226 lines) renders per-platform rows with add/remove; calls `saveSchedulingSlots` via useTransition; hour select (0-23) + minute select (15-min increments) |
| 11 | Calendar page loads calendar events and scheduling slots from server | VERIFIED | `page.tsx:1-4` imports getCalendarEvents + getSchedulingSlots; lines 28+35 call both actions; passes events to CalendarView and slots to SlotConfig |
| 12 | Draft posts panel enables scheduling workflow from calendar page | VERIFIED | `draft-posts.tsx` client component shows unscheduled drafts with Schedule button calling `schedulePost(postId, +1hr)`; integrated in page.tsx:138 |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | schedulingSlots table + retryAt column on postPlatforms | VERIFIED | Lines 94-113: `postPlatforms.retryAt` defined; lines 106-113: `schedulingSlots` table defined |
| `src/db/migrations/0005_scheduling_slots.sql` | Migration SQL for scheduling_slots + retry_at column | VERIFIED | 12 lines; CREATE TABLE scheduling_slots + ALTER TABLE post_platforms ADD COLUMN retry_at TEXT |
| `src/lib/publish.ts` | publishDuePosts with per-platform retry logic | VERIFIED | 186 lines; exports `publishDuePosts`; mutex guard at line 16; per-platform retry at lines 134-163 |
| `src/lib/cron.ts` | Every-minute publish cron registration | VERIFIED | Lines 17-24: `cron.schedule('* * * * *', ...)` with dynamic import of publishDuePosts |
| `src/lib/upload-post.ts` | publishTextPost function | VERIFIED | Lines 65-86: `publishTextPost` exports FormData POST to `/upload_text`; circuit breaker wrapped |
| `src/app/actions/schedule.ts` | 6 server actions for scheduling | VERIFIED | 235 lines; exports schedulePost, reschedulePost, getSchedulingSlots, saveSchedulingSlots, scheduleToNextSlot, getCalendarEvents |
| `src/app/(dashboard)/calendar/page.tsx` | Server component fetching events and slots | VERIFIED | 154 lines; fetches events, brands, slots, draft posts; renders CalendarView + DraftPosts + SlotConfig |
| `src/app/(dashboard)/calendar/calendar-view.tsx` | Client component with FullCalendar drag-and-drop | VERIFIED | 117 lines; contains FullCalendar with editable:true, eventDrop handler, custom eventContent |
| `src/app/(dashboard)/calendar/slot-config.tsx` | Client component for managing time slots | VERIFIED | 226 lines; contains saveSchedulingSlots call via useTransition; add/remove UI per platform |
| `src/app/(dashboard)/calendar/draft-posts.tsx` | Draft posts scheduling panel | VERIFIED | 86 lines; calls schedulePost on button click; router.refresh() after success |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/cron.ts` | `src/lib/publish.ts` | dynamic import in cron callback | WIRED | `cron.ts:19`: `const { publishDuePosts } = await import('./publish')` |
| `src/lib/publish.ts` | `src/lib/upload-post.ts` | publishTextPost call | WIRED | `publish.ts:4`: `import { publishTextPost } from './upload-post'`; called at line 116 |
| `src/lib/publish.ts` | `src/db/schema.ts` | postPlatforms failureCount queries | WIRED | `publish.ts:134-148`: reads `platform.failureCount`, updates with `failureCount: newFailureCount` |
| `calendar-view.tsx` | `src/app/actions/schedule.ts` | reschedulePost on eventDrop | WIRED | `calendar-view.tsx:8`: `import { reschedulePost }...`; called at line 93 |
| `page.tsx` | `src/app/actions/schedule.ts` | getCalendarEvents + getSchedulingSlots | WIRED | `page.tsx:1`: imports both; called at lines 28 and 35 |
| `slot-config.tsx` | `src/app/actions/schedule.ts` | saveSchedulingSlots server action | WIRED | `slot-config.tsx:4`: `import { saveSchedulingSlots }...`; called at line 85 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| SCHED-01 | 05-02, 05-03 | Week and month calendar views showing scheduled and published posts | SATISFIED | CalendarView with dayGridMonth + timeGridWeek toggle; getCalendarEvents returns scheduled/published/failed |
| SCHED-02 | 05-02, 05-03 | Drag-and-drop rescheduling of posts | SATISFIED | CalendarView editable:true + eventDrop -> reschedulePost; revert on error |
| SCHED-03 | 05-02, 05-03 | Platform color coding, content type icons, and status indicators | SATISFIED | PLATFORM_COLORS map + 6px colored dots per platform; STATUS_ICONS (✓/◷/✕) per event; event color from STATUS_COLORS (blue/green/red) |
| SCHED-04 | 05-01, 05-03 | Slot-based scheduling with configurable posting times per brand per platform | SATISFIED | schedulingSlots schema + saveSchedulingSlots server action + SlotConfig UI |
| SCHED-05 | 05-01, 05-03 | Timing jitter (±15 min random offset) on all scheduled posts | SATISFIED | scheduleToNextSlot: `jitterMs = (Math.random() * 30 - 15) * 60 * 1000` applied at slot time |
| SCHED-06 | 05-01, 05-03 | Auto-publish cron job runs every 1 min, publishes via Upload-Post | SATISFIED | cron.ts registers `* * * * *` job calling publishDuePosts -> publishTextPost -> Upload-Post API |
| SCHED-07 | 05-01, 05-03 | Publish retry logic: 3 retries with 5 min backoff, then status=failed | SATISFIED | publish.ts MAX_FAILURES=3, RETRY_DELAY_MS=5min; failureCount incremented per failure; status='failed' at cap |

No orphaned requirements. All SCHED-01 through SCHED-07 are claimed by plans 05-01 and 05-02. Plan 05-03 re-validates all seven.

### Anti-Patterns Found

No anti-patterns detected across all phase files:
- No TODO/FIXME/HACK comments
- No placeholder returns (return null, return {}, return [])
- No stub handlers (console.log only, preventDefault only)
- No empty API route implementations
- All implementations are substantive (publish.ts: 186 lines, schedule.ts: 235 lines, calendar-view.tsx: 117 lines, slot-config.tsx: 226 lines)

### Human Verification Required

All automated checks pass. The following items require human testing due to their visual, runtime, or integration nature:

#### 1. Calendar Month View Renders Correctly (SCHED-01)

**Test:** Visit http://localhost:3000/calendar
**Expected:** FullCalendar month grid renders with dark theme; days are visible; toolbar shows prev/next/today buttons and month/week toggle; no white FullCalendar chrome visible
**Why human:** Visual dark mode rendering cannot be verified programmatically

#### 2. Week View Toggle Works (SCHED-01)

**Test:** Click the "week" button in the calendar toolbar; then click "month" to switch back
**Expected:** Week view with hourly time slots and current time indicator appears; switches back cleanly
**Why human:** FullCalendar view switching is a runtime DOM interaction

#### 3. Platform Colors and Status Indicators Are Visually Clear (SCHED-03)

**Test:** If any scheduled/published/failed posts exist, inspect calendar events
**Expected:** Each event shows a truncated title, 6px colored platform dots (e.g. instagram=#E1306C, linkedin=#0077B5), and status icon (✓ published, ◷ scheduled, ✕ failed)
**Why human:** Color contrast and visual clarity require human judgment

#### 4. Drag-and-Drop Updates Database (SCHED-02)

**Test:** Drag a scheduled event to a different day in month view; release it
**Expected:** Event remains on new day; DB scheduled_at is updated; dragging to invalid area reverts
**Why human:** Drag-and-drop is a real-time browser interaction; DB update requires live environment

#### 5. Slot Configuration Saves and Persists (SCHED-04)

**Test:** Navigate to /calendar?brand=1&schedule=1; add a time slot (e.g. 09:00) for a connected platform; click "Save Schedule"; refresh the page
**Expected:** The added slot reappears after refresh; saveSchedulingSlots wrote to scheduling_slots table
**Why human:** Requires a live brand with connected social accounts and DB persistence verification

#### 6. Draft Posts Panel Enables Scheduling Workflow (SCHED-04)

**Test:** Generate a draft post on a brand page; navigate to /calendar; find the "Draft Posts" section; click "Schedule"
**Expected:** Post gets scheduled 1 hour from now; page refreshes; post appears as calendar event with correct start time
**Why human:** Requires live draft data and calendar event re-render

#### 7. Auto-Publish Cron Fires and Processes Due Posts (SCHED-06)

**Test:** Manually set a post's scheduled_at to 1 minute in the past via DB; watch server console for `[publish]` log lines within the next cron tick
**Expected:** Server logs show the publish attempt; post status changes to published (or failed if no valid Upload-Post account); activityLog entry created
**Why human:** Cron execution requires a live server; Upload-Post integration requires configured API key

#### 8. Retry Logic Caps at 3 Failures (SCHED-07)

**Test:** Trigger publish failure by using an invalid Upload-Post username; observe failureCount increment and retryAt being set; after 3 failures, verify status=failed
**Expected:** failureCount = 1 after first failure with retryAt = now+5min; failureCount = 2 same pattern; failureCount = 3 sets status='failed' with no retryAt
**Why human:** Requires controllable publish failures and DB inspection over multiple cron ticks

#### 9. Dark Mode — No Light Calendar Elements (SCHED-03)

**Test:** View /calendar in a browser; inspect all FullCalendar elements (toolbar buttons, day headers, day numbers, today highlight, event backgrounds)
**Expected:** All elements use dark backgrounds matching the app's dark theme; no jarring white or light-gray FullCalendar defaults visible
**Why human:** Visual quality requires browser inspection; CSS variable resolution cannot be verified statically

### Gaps Summary

No gaps. All 12 observable truths are verified at all three levels (exists, substantive, wired). All 7 SCHED requirements are satisfied by verified artifacts. No anti-patterns found. All commits are valid and present (0df16a5, d703c6e, c391a0b, 35d6eb6, 34ecd36).

The phase goal — "Content calendar visualization and automated publishing with smart scheduling" — is achieved in code. The 9 human verification items listed above cover visual rendering, real-time interactions (drag-and-drop), live cron execution, and external API integration (Upload-Post). These cannot be verified statically but the code supporting each is complete and wired.

---

_Verified: 2026-03-18T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
