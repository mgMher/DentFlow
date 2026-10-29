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
| Appointments | ✅ Cleaned | Week/day view per chair not built yet (F2) |
| Schedule | ✅ Cleaned | — |
| Treatments catalog | ✅ Cleaned | — |
| Dental chart | ✅ Cleaned | FDI, per-surface, planned/done; no periodontal chart yet (F12) |
| Billing | ✅ Cleaned | Fiscal receipts (F10) and deposits (F4) not built |
| Reports | ✅ Cleaned | Export / commission (F11) not built |
| Dashboard | ✅ Cleaned | Activity is rebuilt from records until the audit log (F7) |
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

### Phase 2 — Patients & Staff — ✅ done 2026-10-28 (not committed yet)

- [x] **P1** Patient stats aggregate cast (done in Phase 1)
- [x] **P1** `isActive` removed from `PATCH /users/:id` (only `/status`, with its guards); `null` on required fields rejected (`IsOptionalNotNull`) for staff and patients
- [x] **P2** Startup fixes run once per database (`common/migrations/run-once.ts`, `migrations` collection): patient status backfill, phone normalisation (now also emergency phones, bulk write, logs ids not numbers), appointment dentist repoint, founder backfill, token cleanup
- [x] **P2** New staff start with the clinic's opening hours
- [x] **P2** Specialization: backend `@IsIn` the same 8 values as the UI; legacy free text still shown in the select
- [x] **P2** Multi-word search ("Armen Hakobyan"); `_id` sort tie-breaker
- [x] **P2** Duplicate check: `GET /patients/duplicates` — exact name + birth date, phone or email; opens matches in a new tab; excludes the patient being edited
- [x] **D4** Patient email no longer unique (families); index dropped by a one-off migration
- [x] **P2** List pages keep the search box mounted while loading (patients, staff)
- [x] **P2** Emergency phone without a name / policy without a provider → inline error instead of silently dropped
- [x] **P2** Archive/deceased patient or deactivate dentist: dialog shows upcoming appointments and can cancel them (`UpcomingAppointmentsService`)
- [x] **D5 (patients)** Roles: assistants read only; receptionists edit demographics but not medical history (403 `medicalHistoryForbidden`, fields read-only in the form) or status; buttons hidden per role on patient and staff pages
- [x] **P3** `PatientCreatePage` + `PatientEditPage` → one `PatientEditor` (1 271 → 755 lines); status removed from the edit form (audited dialog only)
- [x] **P3** `PatientDetailPage`: profile tab → `PatientProfileTab`, status → shared `PatientStatusDialog` (1 402 → ~900 lines). Chart / appointments / billing tabs are extracted in Phases 4 / 3 / 5, where they are rewritten anyway
- [x] **P3** `DELETE /patients/:id` and `/restore` removed (deceased → inactive bug); `updateStatus` conditional on the status read (409 `patientStatusChanged`)
- [x] **P3** "New this month" in the clinic timezone (`ClinicRefsService.timezoneOf`)
- [x] **P3** Photo/avatar limit 150k chars with explicit 300 kb body limit (was an unreachable 2 MB and a bare 413); avatar format validated; staff phones normalised
- [x] **P3** Dead code removed (`formatPhone`, `deleteStaff`, `PATIENT_STATUS_COLORS`, `PaginatedResponse`); `StatusChip` `sx` merge; `EmptyState` action icon; `PageHeader` wraps; emergency-contact label; formatted staff phone
- [ ] Deferred: one login per person across clinics (auth email is global) — needs a membership model, later with the platform admin (F13)
- [x] Verified on local MongoDB: 33 new API checks (`smoke2.mjs`) + Phase 0/1 suite; browser: duplicate warning, status dialog with appointment count

### Phase 3 — Appointments & Schedule — ✅ done 2026-10-28 (not committed yet)

- [x] **P0** Body ids verified against the clinic (Phase 0 helper, now inside one `assertRefs`)
- [x] **P1** Calendar returns the list shape (`startTime`, populated `patientId`…) with an overlap range; cancelled hidden unless asked
- [x] **P1** List: date range / dentist / patient / status / page on the server, `limit` ≤ 100, stable sort
- [x] **P1** Status: validated DTO + transition table (`TRANSITIONS`); completed is final; in progress / completed / no-show only once the visit has started (30 min grace); rebooking a cancelled / no-show re-checks the slot; conditional update against concurrent clicks
- [x] **P1** Booking rules (`ScheduleService.assertDentistAvailable` + `findClash`): dentist, room **and** patient overlaps; blocked time never overridable; dentist's working hours (fallback: clinic hours) with an explicit "book anyway" override
- [x] **P1** Double booking under concurrency: post-insert recheck, the later document yields (3 parallel requests → exactly 1 booking)
- [x] **P1** Availability and "today" in the clinic timezone; empty intervals dropped (no free slot past closing)
- [x] **P1** Recurring series: generated on the clinic calendar (same local time, month-end clamped), max 52 / one year, `seriesId`, skipped dates returned with a reason code, "cancel this and following"
- [x] **P1** Detail page: never shows the previous appointment; error / not-found state; response of every action replaces the view
- [x] **P2** `treatmentIds` from the catalogue (duration follows), no hardcoded English title (`title` optional, label derived)
- [x] **P2** One populate list everywhere (room / treatments no longer lost after a status change)
- [x] **P2** Status chip keys (`in_progress` / `no_show`) via `statusKey`
- [x] **P2** Structured cancel reasons + note + who/when; system reasons when a patient / dentist leaves
- [x] **P2** Blocked times: overlap range (multi-day vacations shown), roles (dentists: own time only, assistants: view), confirm delete, warning when a block covers booked visits; `isRecurring` removed (never implemented)
- [x] **P2** Rooms: unique name per clinic (409 `roomNameTaken`), buttons gated, Save disabled while saving
- [x] **P2** Patient page appointments tab → `PatientAppointmentsTab` with its own store slice, pagination and "Book appointment"
- [x] **P2** Walk-ins: scheduled → in progress / completed allowed; reschedule dialog (shared `AppointmentFormDialog`)
- [x] **P3** `status` / recurring fields removed from the create DTO; `CancelAppointmentDto`; patient fixed on update
- [x] **UX** Booking dialog: free-time chips from the availability API, treatments autocomplete, duration presets, repeat; month title in the UI language
- [x] Verified on local MongoDB: 48 booking-rule checks (`smoke3.mjs`) + browser (calendar, booking dialog with free time, detail actions, cancel dialog)
- [ ] Not built yet (feature list): week / day view per chair with drag-to-reschedule (F2), reminders (F3), waitlist, buffer time between visits

### Phase 4 — Treatments catalog & Dental chart — ✅ done 2026-10-29 (not committed yet)

- [x] **P0** `setChartType` no longer wipes anything (D6): the current teeth go to `archivedCharts`, switching back restores them; `@Roles(admin, dentist)`
- [x] **P0** Dentist / treatment / appointment ids checked against the clinic (Phase 0 helper; catalogue defaults via `ClinicRefsService.getTreatment`)
- [x] **P1** `@Roles(super_admin, clinic_admin, dentist)` on every chart and entry write (`CHART_EDITORS`); receptionist / assistant view only, UI shows "View only"
- [x] **P1** Odontogram rewritten (`components/dental/`): FDI rows as the dentist faces the patient (lower arch no longer mirrored), five-part surface diagram per tooth
- [x] **P1 / D1** FDI numbering (`tooth-numbering.ts`, 5 unit tests); one-off migration converts charts, tooth history and entries from Universal (`2026-10-dental-fdi-numbering`, idempotent per document)
- [x] **P1** Per-surface findings: `surfaces: [{ surface, status: decayed / filled / sealant }]`; old surface lists migrated (decayed tooth → caries, otherwise filling). Paint-brush surface editor in the drawer
- [x] **P1** Entries are `planned` or `done`; done applies `resultStatus` to the chart (filling turns the treated surfaces from caries to filling, extraction → missing, crown/implant clear surfaces). `PATCH …/treatment-entry/:id/complete`; chart is updated before the entry is stored / the entry is rolled back if the chart save fails
- [x] **P1** `teeth: number[]` — none (exam, X-ray, cleaning), one, or several (bridge); any FDI tooth, mixed dentition allowed
- [x] **P1** Chart tab checks `chart.patientId` (no previous patient's teeth); create-chart race reads the winner instead of a 500
- [x] **P1** Catalogue: server-side search / category / active filter / pages (20/50/100, `limit` ≤ 100); real total; `PATCH /treatments/:id/reactivate`
- [x] **P1** Pickers load active items only (`GET_ACTIVE_TREATMENTS`); search regex escaped (Phase 0)
- [x] **P2** Entries record `createdBy`, `completedBy`; void (`PATCH …/void`, reason ≥ 3) instead of delete, hidden unless "Show voided"; tooth history shows who changed it and "via treatment"
- [x] **P2** Concurrent chart edits: optimistic concurrency, reload + re-apply up to 5 times (different teeth both survive), then 409 `chartChanged` and the UI reloads the chart. `VersionError` → 409 `recordChanged` globally
- [x] **P2** Unique catalogue code per clinic (partial unique index, upper-cased, 409 `treatmentCodeTaken`); existing duplicates renamed `-2`, `-3` by migration. Seed URL fixed (`/treatments/seed-defaults`) + "Add the standard catalogue" on an empty catalogue
- [x] **P2** Names shown in the UI language (`localizedTreatmentName`, also `references.treatmentName`); empty optional fields clear on edit; dialog stays open until the server accepts
- [x] **P2** Odontogram: every tooth a keyboard button with a spoken label, focus ring, theme colours (dark mode), distinct colours + letter marks (not colour alone)
- [x] **P2** Patient "Treatments" tab (`PatientTreatmentsTab`): plan + record, filters, pagination, mark done, void, add without a tooth
- [x] **P3** Orphan `DentalChartPage` + `/patients/:id/chart` route deleted; one copy of the maps in `utils/dental.ts`; old `Odontogram` / `ToothTreatmentForm` removed
- [x] **D5 (catalogue)** Only the clinic admin edits the catalogue (dentists could before) — `CATALOG_EDITORS`
- [x] **NEW** Catalogue items carry `toothStatus` ("tooth becomes"), prefilled into entries; default items backfilled by code
- [x] Verified on local MongoDB: 53 checks (`test/smoke/04-dental-treatments.mjs`) + suites 01–03 + legacy-data migration + browser (FDI chart, surface editor, planned → done, treatments tab, void, catalogue, dark mode)
- [ ] Voiding an entry does not undo its chart change (by design; correct the tooth by hand). Revisit with the audit log (F7)
- [ ] Catalogue grid view dropped (table only, with search and paging)

### Phase 5 — Billing — ✅ done 2026-10-29 (not committed yet)

- [x] **P0** Patient / appointment / treatment ids checked against the clinic (Phase 0 helper); billed chart entries must be this patient's
- [x] **P0** Payment: balance check, amount and status in **one conditional update** (pipeline update, no transaction — the local Mongo is standalone; works on Atlas too). Payment insert failing puts the invoice back. 3 parallel payments on a 13 500 balance → exactly 2 accepted
- [x] **P0 / D3** One currency per clinic: invoices take the clinic's currency (another → 400 `currencyMismatch`), payments must match the invoice. Shared `Currency` enum (`common/utils/money.util.ts`) replaces five copies
- [x] **P1** Invoice number: atomic per-clinic, per-year counter (`counters` collection) → `INV-2026-00042`; 5 parallel creates → 5 unique numbers
- [x] **P1** Lifecycle draft → issued → partial / paid; `pending` migrated to `issued`; "overdue" computed (issued/partial past due date in the clinic's today) — `isOverdue` on every invoice and `status=overdue` filter. Payments need an issued invoice; zero total can't be issued
- [x] **P1** Cancel only with nothing paid (`invoiceHasPayments`), with a reason, who and when. Drafts: anyone who bills; issued: admin. Refund / void a payment (admin, `refund` or `mistake`, reason) — stays on record, balance goes back
- [x] **P1 / D5** `@Roles`: admin + receptionist bill; dentist views; assistant none (403, menu hidden); refunds and revenue admin only
- [x] **P1** Search works on the server: invoice number, patient name (multi-word, shared `patientSearchClauses`) or phone
- [x] **P1** `<PatientPicker>` in the invoice form (Phase 0); `?patientId=` pre-fills it from the patient page
- [x] **P1** Lines from the catalogue (localized name, price when in the invoice currency) or **from done treatment entries** (`GET /billing/patients/:id/unbilled-treatments`); an entry is on at most one live invoice (`TreatmentEntry.invoiceId`, claimed all-or-none, 409 `treatmentAlreadyBilled`), released when the line is removed or the invoice cancelled; a billed entry can't be voided
- [x] **P1** Line discount shown as % (was formatted as money)
- [x] **P2 / D2** Integer money in the smallest unit (dram, cents); API keeps major units; amounts finer than the currency → 400 `amountPrecision`; exact remaining balance accepted; one-off migration (`2026-10-billing-integer-money`, per-document marker) — 0.10 + 0.20 USD pays 0.30 exactly
- [x] **P2** Detail page: shows only the invoice in the URL; every action's response replaces it; dialogs close when the server says yes and show errors inline
- [x] **P2** Labels: "Full name", "Reference" (was "Amount #"), "Payments", "Unit price", "Discount %", "Received by"
- [x] **P2** Print: app chrome hidden, clinic letterhead (name, address, phone, email) printed above the invoice
- [x] **P2** Currency from the clinic (read-only in the form); appointment picker loads only the patient's (Phase 3)
- [x] **P2** Patient billing tab (`PatientBillingTab`): billed / paid / balance / overdue per currency without drafts or cancelled, unbilled treatments count, "Create invoice", paginated list
- [x] **NEW** Edit drafts (`/billing/:id/edit`), Issue button, status tabs incl. Draft / Issued / Overdue / Cancelled
- [x] Verified on local MongoDB: 53 checks (`test/smoke/05-billing.mjs`) + suites 01–04, legacy-data migration (USD decimals → cents, `pending` → `partial`), browser (invoice from treatments, totals, issue, payment, list)
- [x] **For Phase 6:** reports divide minor units back and skip voided payments (done in Phase 6)
- [ ] Not built: e-HDM fiscal receipt (F10), deposits / one payment across invoices (F4), PDF export (print-to-PDF works)

### Phase 6 — Reports & Dashboard — ✅ done 2026-10-29 (not committed yet)

- [x] **P1** Reports page rewired: range presets (this month, last month, 30 days, this year, custom), day / week / month grouping, every number from an endpoint that returns it; responses for another range are never shown
- [x] **P1** Dashboard reads the fields the backend returns: today (non-cancelled), active patients + new this month, open / overdue invoices, month revenue; upcoming appointments populated
- [x] **P1** Recent activity built from the records (new patients, bookings, treatments done, invoices issued, payments) with who and when, newest first, clickable — until the audit log (F7)
- [x] **P1** `GET /reports/dashboard` open to every role; each part only for roles that see it elsewhere (revenue: admins; invoices: billing viewers); dentists get their own appointments
- [x] **P0** Revenue in the clinic currency only (D3), minor units divided back (D2); legacy payments in another currency listed apart, never added
- [x] **P1** Date ranges are clinic days in the clinic timezone, end date included; `$dateTrunc` / `$dateToString` with timezone; periods zero-filled (`report-periods.ts`, unit-tested)
- [x] **P1** One revenue definition: **collected** = payments received in the period, not voided. Per dentist and per treatment split those payments over the invoice lines they paid (dentist from the treatment entry, else the invoice appointment), so the parts add up to the total. Invoiced and outstanding shown beside it, labelled as such
- [x] **P1 / D5** Reports: admins all; dentists their own appointments, row and treatments without money; revenue admin only. `/billing/revenue` removed (one definition, in `/reports/revenue`)
- [x] **P2** `ReportQueryDto`: `YYYY-MM-DD` dates (defaults: 1st of this month → today), `groupBy`; start after end → 400 `invalidDateRange`; > 400 periods or 10 years → 400 `reportRangeTooLong`
- [x] **P3** `getPatientStats` filter used (new patients in the range); unused `/billing/invoices/overdue` removed (the list's `status=overdue` replaces it)
- [x] Staff → Performance tab reads the new report (this year; collected for admins); shown to a dentist on their own profile only
- [x] Verified on local MongoDB: 57 checks (`test/smoke/06-reports-dashboard.mjs`) + suites 01–05, browser (admin dashboard and reports, grouping and presets, dentist views)
- [ ] Not built: CSV / Excel export and dentist commission (F11), daily cash report (F5), comparison with the previous period
- [ ] Mobile: the sidebar is a permanent drawer and covers the page on phones (all pages, pre-existing)

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
