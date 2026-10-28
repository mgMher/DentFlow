# DentFlow — Cleanup & Feature Plan

Written 2026-09-30 after a full read of every file in backend + frontend (26k lines, 12 modules).
Work top to bottom. Tick a box when the fix is done **and** its row in `TEST-CASES.md` is added.

**Severity:** `P0` security / data loss / wrong money · `P1` feature broken or wrong data · `P2` UX / edge case · `P3` cleanup

---

## 1. Where the project really is

Honest summary: **the UI looks finished, but most modules below Patients/Staff are only half wired.**
Many pages call endpoints with the wrong fields, read fields the backend never returns, or load only
the first 20 records. There are **zero automated tests**, and TypeScript `strict` is off on both sides.

| Module | State | Worst problem |
|---|---|---|
| Auth | Works on the happy path | **P0** — `.env` JWT secrets are ignored; tokens are signed with the public `dev-access-secret`, so anyone can forge an admin token for any clinic |
| Clinic settings | Half works | Room edit and room delete are both broken; subscription is editable by the clinic |
| Patients | ✅ Cleaned | "Active" stat always 0; founding admin has no staff profile |
| Staff | ✅ Cleaned | Two ways around the "last admin" guard; deactivated staff keep access 24h |
| Appointments | Half works | **P0** tenant leak; calendar view always empty; only the 20 oldest appointments load; patient #21+ can't be booked |
| Schedule | Half works | Availability 4h off (UTC vs Yerevan); booking ignores blocked times and working hours |
| Treatments catalog | Half works | Only 20 items shown; "delete" can't be undone; ReDoS in search |
| Dental chart | Works, but wrong for the market | **P0** switching adult/pediatric deletes the whole chart + history, any role can do it. Lower jaw drawn mirrored. US numbering instead of FDI |
| Billing | Works only in AMD, only via UI | **P0** tenant leak, payment race, currencies summed together. Invoice creation often impossible (patient picker empty) |
| Reports | **Broken** | Every revenue request returns 400; charts always empty |
| Dashboard | Mostly broken | 2 cards always 0; receptionists get "Insufficient permissions" on login |
| Notifications | **Never created** | Nothing in the app ever creates a notification; bell hardcoded to 0 |

---

## 2. Decisions needed before we start (please answer)

| # | Question | My recommendation |
|---|---|---|
| D1 | Tooth numbering | **FDI** (11–48 adult, 51–85 child) — it is the standard in Armenia/Russia. Current US numbering needs a migration |
| D2 | Money storage | Store **integer amounts** (AMD has no minor unit; USD/RUB in cents). Fixes rounding bugs forever |
| D3 | Multi-currency | **One currency per clinic** for now (from clinic settings). Invoices/payments must match it. Reports never sum different currencies |
| D4 | Patient email unique per clinic? | **Drop the unique rule**, keep a warning — families share one email for their kids |
| D5 | Role matrix | See §5. Needs your yes/no per row |
| D6 | Adult ↔ pediatric chart | Keep a **snapshot** of the old chart instead of deleting it (later: mixed dentition) |

---

## 3. Cleanup order — module by module

Why this order: Phase 0 builds the shared pieces every later module needs (tenant check, timezone,
patient picker, error toasts, role gating). Billing comes after the chart because invoices must be
built from treatment entries. Reports come after billing because they read billing data.

### Phase 0 — Foundation (cross-cutting, must go first) — ✅ done 2026-10-28, branch `fix/phase-0-foundation`

- [x] **P0** JWT config read lazily after `.env`; startup refuses weak/missing/identical secrets when `MODE=PROD` (`config/jwt.config.ts`)
- [x] **P0** `ClinicRefsService` (`common/clinic-refs`) — every body id checked against the caller's clinic in appointments (create/update/recurring), billing (invoice create/update), dental records (entry + first chart creation). Archived/deceased patients can't be booked or billed
- [x] **P1** Exception filter: Mongoose `ValidationError`/`CastError`/`E11000`/`BSONError` → 400/409 with a `code`; every status gets a fallback `code`
- [x] **P2** `ParseObjectIdPipe` on every `:id` param (18 routes added)
- [x] **P1** AuthGuard re-reads the user each request: deactivated, demoted or moved users lose access immediately. Access TTL default 15 min. Dropped the second `access-token` header channel
- [x] **P1** axios: one shared refresh for parallel 401s; no refresh/redirect for `/auth/*` (login errors now readable)
- [x] **P1** `ProtectedRoute` loads profile + clinic after reload, with a retry screen instead of an endless spinner
- [x] **P1** Toasts are event-based (`store/http/toasts.ts`): no re-fired old toasts, load errors stay for the page to render, every saga error translated via `apiErrorMessage` (52 new keys × 3 languages), success toasts for treatments/billing/settings
- [x] **P1** Role gating: `utils/permissions.ts` (mirrors backend `@Roles`), `usePermission()`, `RequirePermission` route guard, sidebar filter. Reports + Settings gated. *Button-level gating is done per module in its phase.*
- [x] **P1** Timezone: backend `common/utils/clinic-time.util.ts` (+ 8 unit tests, DST-safe); frontend `utils/dates.ts` replaces 7 UTC "today" bugs. *Backend queries switch to it module by module.*
- [x] **P1** `<PatientPicker>` (server-side search, archived/deceased disabled) in the appointment and invoice forms
- [x] **P1** Login: password checked before "deactivated" (no account enumeration); translated codes `invalidCredentials` / `accountDeactivated` / `accountEmailTaken`
- [x] **P1** `seed.ts`: real schemas and collections, replaces only its own demo clinic, refuses `MODE=PROD`
- [x] **P3** Production Dockerfile (multi-stage, `node dist/main`, non-root) + `.dockerignore`; compose keeps watch mode via `target: build`
- [x] Treatments search regex escaped (was a 500 / ReDoS) — shared `escapeRegex`, `errorBody` moved to `common/utils`
- [ ] **Not verified at runtime yet** — needs a MongoDB to boot against (see TEST-CASES §12)
- [ ] ~~One shared `Currency` enum~~ → moved to Phase 5 (billing owns it)

### Phase 1 — Auth & Clinic settings — ✅ done 2026-10-28 (same branch, not committed yet)

- [x] **P1** Register creates the founder's `UserProfile` + startup backfill for existing founders (`AuthService.onModuleInit`)
- [x] **P1** Register cleans up clinic/user/profile on failure; duplicate race → 409 `accountEmailTaken`; seeds the default treatment catalogue
- [x] **P1** Rate limits (`@nestjs/throttler` v4, per IP, auth routes only) + per-account lockout (5 wrong passwords → 15 min, `accountLocked`)
- [x] **P1** Per-device sessions (`auth_sessions`, SHA-256 hashed refresh tokens, rotation with reuse detection + 30 s two-tab grace, max 10 per user). Guard rejects revoked sessions. Legacy plaintext `refreshToken` fields removed at startup
- [x] **P1** Logout revokes only this device; new "Sign out of all devices"
- [x] **P1** `subscription` removed from the clinic update DTO
- [x] **P1** Settings: empty email/phone accepted (clears the field); phone validated + normalised
- [x] **P1** Settings: room edit (PATCH) and deactivate/reactivate (were calling create / delete-template)
- [x] **P2** One password policy (8–72) shared by register, staff create, change, reset; login form no longer blocks old short passwords
- [x] **P2** Working hours: HH:mm, open days end after start, no duplicate days (server + inline in the form); IANA timezone validated; full timezone list
- [x] **P2** Dark-mode switch removed from Settings (theme and UI language are per user, in the header); "Appearance" → "Language & currency" with clinic defaults only
- [x] **P2** Hardcoded English labels replaced; template table shows translated type/channel
- [x] **P2** Settings never renders forms without the real clinic (load error → retry), so Save can't overwrite real hours with defaults
- [x] **P2** "Forgot password?" explains to ask the admin (self-service email reset = F9)
- [x] **NEW** Change password (self, signs out other devices) and admin "Reset password" on the staff page (signs the member out everywhere, clears lockout)
- [x] **P2** `ClinicGuard` enforces `Clinic.isActive` (60 s cache) → `clinicInactive`
- [x] **P3** `useHttpState` callbacks stable (`useCallback`)
- [x] **P0 (found while testing)** Every schema reference (`clinicId`, `patientId`, … 40 fields) was declared `type: Types.ObjectId`, which @nestjs/mongoose 9 + Mongoose 7 silently turn into `Mixed`: nothing was cast, API-written docs stored string ids, seeded/old docs ObjectIds, and each query only matched one kind. Schemas now use `Schema.Types.ObjectId`; one-off startup repair `common/migrations/objectid-repair.service.ts` converts stored strings (recorded in `migrations`)
- [x] **P1** Patient stats aggregate cast fixed ("Active" was always 0)
- [x] **P1** Refresh tokens get a `jti` — two issued in the same second were identical, defeating rotation
- [x] **P2** Error filter passes message parameters (e.g. lockout `minutes`)
- [x] **P2** Layout: `minWidth: 0` on `<main>` — every page scrolled sideways at ~1024 px
- [x] Verified end-to-end on local MongoDB: 57 API checks (scratchpad `smoke.mjs`) + browser pass of login, settings, rooms, change password, patient picker
- [ ] Deploy note: everyone signs in once after this ships (old tokens have no session id)
- [ ] PROD: create the TTL index by hand — `db.auth_sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })` (autoIndex is off in PROD); set `TRUST_PROXY=1` behind the load balancer

### Phase 2 — Patients & Staff (finish)

- [ ] **P1** Patient stats aggregate: `clinicId` string not cast → "Active" always 0
- [ ] **P1** `PATCH /users/:id` with `isActive:false/null` bypasses self-deactivate and last-admin guards
- [ ] **P2** `null` on required fields → 500 (patients + users)
- [ ] **P2** Phone migration runs a full scan every boot and logs patient phones (PII) → one-off script
- [ ] **P2** New staff have no working hours → dentist unbookable until admin edits
- [ ] **P2** Specialization: free text on backend vs enum on frontend (seeded values render blank)
- [ ] **P2** Search "Armen Hakobyan" finds nothing → token search
- [ ] **P2** Duplicate-patient warning misses matches (substring + limit 50); add phone match
- [ ] **P2** List spinner replaces the page → search box loses focus
- [ ] **P2** Emergency phone without name / policy without provider silently dropped
- [ ] **P2** Deactivating a patient or dentist leaves future appointments booked → prompt to cancel/reassign
- [ ] **P3** Merge `PatientCreatePage` + `PatientEditPage` (~560 identical lines) into one `<PatientForm>`
- [ ] **P3** Split `PatientDetailPage.tsx` (1402 lines) into tabs/components
- [ ] **P3** Dead code: `formatPhone`, `deleteStaff`, unused constants; status select on edit form

### Phase 3 — Appointments & Schedule

- [ ] **P0** Verify patient/dentist/room/treatment ids belong to the clinic (uses Phase 0 helper)
- [ ] **P1** Calendar: backend returns `start/patient`, page reads `startTime/patientId` → calendar always empty
- [ ] **P1** List: send date range/filters/page to the server + pagination (today: 20 oldest ever)
- [ ] **P1** Status: validated DTO + server-side transition table (any string / any jump allowed now)
- [ ] **P1** Conflict check: add room, patient, blocked times, working hours; re-check when leaving no-show
- [ ] **P1** Availability: compute in clinic timezone (4h off now)
- [ ] **P1** Recurring: cap occurrences (DoS), return skipped dates, `seriesId`, validate end date
- [ ] **P1** After cancel, detail page shows stale status; bad id → endless spinner
- [ ] **P2** Save `treatmentIds` (form saves a name string → treatments/billing links always empty)
- [ ] **P2** Status chip shows raw `in_progress` / `no_show` (missing keys)
- [ ] **P2** Hardcoded `title: 'Appointment'`; no end > start check in form
- [ ] **P2** Status/cancel responses not populated → room and treatments show "-"
- [ ] **P2** Calendar/blocked-times range filter misses items crossing the edge
- [ ] **P2** Blocked times: `@Roles`, confirm delete, warn about booked appointments in the block
- [ ] **P2** Rooms: disable Save while saving, unique name, gate by role
- [ ] **P2** Patient detail writes into the shared appointments list
- [ ] **P2** Walk-in: allow scheduled → in_progress; add reschedule dialog (endpoint exists)
- [ ] **P3** Remove `status` from create DTO; `CancelDto`; `@Max(100)` on limit; dead code

### Phase 4 — Treatments catalog & Dental chart

- [ ] **P0** `setChartType` wipes the chart + history → snapshot instead (D6); `@Roles(dentist, admin)`
- [ ] **P0** Verify dentist/treatment/appointment ids belong to the clinic
- [ ] **P1** `@Roles` on all chart write endpoints (receptionist can record clinical treatments now)
- [ ] **P1** Odontogram lower arch mirrored (clinicians click the wrong tooth)
- [ ] **P1** FDI numbering + migration (D1)
- [ ] **P1** Per-surface status (mesial decayed + occlusal filled is impossible now)
- [ ] **P1** Treatment entry: planned / done status; "done" updates tooth status
- [ ] **P1** Tooth optional on entry (exam, X-ray, cleaning); multi-tooth (bridge)
- [ ] **P1** Chart shows previous patient's teeth when switching patients; create-chart race → 500
- [ ] **P1** Catalog: total always 0, only 20 items, no pagination; reactivate after "delete"
- [ ] **P1** Treatment picker shows inactive items; search regex not escaped (500 / ReDoS)
- [ ] **P2** `createdBy` + void (not delete) for entries; show who changed each tooth
- [ ] **P2** Concurrent chart edits → 500 (VersionError) → 409 + refetch
- [ ] **P2** Unique catalog code; seed default catalog on clinic register (endpoint URL is wrong too)
- [ ] **P2** Localized treatment names (hy/ru); can't clear optional fields on edit
- [ ] **P2** Odontogram accessibility + dark mode + distinct colors
- [ ] **P2** Patient "Treatment history" tab (data is fetched, never shown)
- [ ] **P3** Delete orphan `DentalChartPage` route; one copy of status/surface maps

### Phase 5 — Billing

- [ ] **P0** Verify patient/appointment/treatment ids belong to the clinic
- [ ] **P0** Payment: atomic balance check + `$inc` in a transaction (race → overpayment, lost payment)
- [ ] **P0** Payment currency must equal invoice currency (D3)
- [ ] **P1** Invoice number: atomic per-clinic counter (duplicates under concurrency → 500)
- [ ] **P1** Status lifecycle: draft → issued → partial/paid, overdue computed from due date; missing tabs
- [ ] **P1** Block cancelling a paid/partly paid invoice; add refund / void payment with audit
- [ ] **P1** `@Roles` on billing (assistant can cancel invoices and read revenue now)
- [ ] **P1** Search box sends `search` → 400 on every keystroke
- [ ] **P1** Patient picker empty (`limit:1000` > max 100) → use `<PatientPicker>`
- [ ] **P1** Line items from the catalog (treatmentId + price); **create invoice from done treatment entries** with double-billing guard
- [ ] **P1** Line discount shown as money instead of %
- [ ] **P2** Integer money (D2); float balance check rejects exact remaining amount
- [ ] **P2** Detail page: stale data after cancel/between invoices; dialog closes before server answers
- [ ] **P2** Wrong labels ("First name" for full name, "Amount #" for reference, etc.)
- [ ] **P2** Printable invoice with clinic details (print stylesheet or PDF)
- [ ] **P2** Default currency from clinic; appointments picker loads all appointments
- [ ] **P2** Patient billing tab: cancelled invoices shown as debt; add balance summary + "Create invoice" button

### Phase 6 — Reports & Dashboard

- [ ] **P1** Reports page: sends `period` (400), reads fields no endpoint returns → rewire to existing endpoints
- [ ] **P1** Dashboard: field names don't match backend (2 cards always 0, activity always empty)
- [ ] **P1** Dashboard endpoint forbidden for receptionist/assistant (their landing page)
- [ ] **P0** Revenue: group by currency, never sum AMD + USD + RUB
- [ ] **P1** Date ranges in clinic timezone; end date inclusive; `$dateToString` with timezone
- [ ] **P1** One revenue definition (collected payments vs billed) used by every report
- [ ] **P2** Query DTOs for reports (missing dates → Invalid Date)
- [ ] **P3** Unused filter in `getPatientStats`; delete or wire unused endpoints

### Phase 7 — Notifications

- [ ] **P1** Actually create notifications (new appointment, cancellation, payment received, …)
- [ ] **P1** Mark-read / delete must check `recipientId` (any user can delete others' notifications)
- [ ] **P2** `isRead=false` filter returns read items (`@Type(() => Boolean)` bug)
- [ ] **P2** Header bell: real unread count + polling
- [ ] **P2** Mark-read updates the list; pagination; confirm delete; link to related item

### Phase 8 — Safety net

- [ ] Backend e2e tests for: tenant isolation, auth/refresh, payment race, conflict detection, status transitions
- [ ] Turn on TypeScript `strict` (backend first, then frontend) — fix what it finds
- [ ] Run the full `TEST-CASES.md` checklist in hy / ru / en

---

## 4. New features (after cleanup), in priority order

| # | Feature | Why |
|---|---|---|
| F1 | Treatment plan (planned → accepted → done) with printable estimate | Core dental workflow; drives billing |
| F2 | Week / day calendar per dentist or chair, drag-to-reschedule, slot picker from availability | Reception works in day view |
| F3 | Appointment reminders (SMS / Telegram) using existing templates | #1 no-show reducer |
| F4 | Patient account: running balance, prepayment, one payment across invoices | Real clinics take deposits |
| F5 | Daily cash report (Z-report) by method and cashier; debtors list | End-of-day routine |
| F6 | X-rays / documents per patient and per tooth (file store, not base64) | Every clinic needs it |
| F7 | Audit log: who changed what (patient data, chart, payments, settings) | Medical + money data |
| F8 | Guardian / family links for children | Pediatric patients |
| F9 | Password reset by email, 2FA for admins, "log out everywhere" | Security basics |
| F10 | e-HDM fiscal receipt (Armenia) | Legal requirement for cash |
| F11 | Export reports to Excel/CSV; dentist commission from collected revenue | Owners ask for it |
| F12 | Periodontal chart, mixed dentition | Specialist clinics |
| F13 | Platform super-admin (list clinics, support) | Needed to run the SaaS |

---

## 5. Proposed role matrix (D5)

| Area | Admin | Dentist | Receptionist | Assistant |
|---|---|---|---|---|
| Patients — demographics | edit | edit | edit | view |
| Patients — medical history, status | edit | edit | view | view |
| Appointments | all | own + view all | all | view |
| Dental chart / treatment entries | edit | edit | view | view |
| Treatment catalog | edit | view | view | view |
| Billing — invoices, payments | all | view | all | — |
| Billing — cancel, refund | yes | — | — | — |
| Reports / revenue | all | own performance | — | — |
| Staff | all | own profile | own profile | own profile |
| Clinic settings, rooms | edit | view | view | view |
| Blocked times | all | own | all | — |
