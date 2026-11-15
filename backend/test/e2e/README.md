# Backend e2e tests

Jest tests that boot the whole API in-process (the same pipes, filters and
`/api` prefix as `main.ts`, via `src/app.setup.ts`) on a random port and call
it over HTTP.

```bash
# needs a local MongoDB (brew services start mongodb-community, or docker compose up mongodb)
npm run test:e2e
npm run test:e2e -- appointments      # one file
```

- Each file gets its own database, `dentflow_e2e_<random>`, dropped when the file finishes.
- `env.ts` sets `MONGO_URI` and the JWT secrets before anything loads, so `.env` is never used. It refuses any
  Mongo host other than `127.0.0.1`, `localhost`, `::1` or `mongodb` (the compose service); point
  `E2E_MONGO_URI` at another local server if needed.
- Rate limits are off except in the one test that checks registration's limit.
- No seed needed: every file registers its own clinics.
- Email never leaves the test (no SMTP; messages land in `MailService.outbox`), and two-factor is not required unless a test turns it on.

| File | Covers |
|---|---|
| `auth.e2e-spec.ts` | forged, expired and wrong-secret tokens, stale role, refresh rotation and reuse detection, tabs refreshing at once, logout / logout-all, change password, deactivation, demotion, lockout, register rate limit |
| `tenant-isolation.e2e-spec.ts` | another clinic cannot read, change or reference any record by id in the URL or the body; nothing leaks into its lists and reports |
| `payments.e2e-spec.ts` | parallel payments never overpay, parallel voids, pay vs void, pay vs cancel, edit vs issue, invoice status lifecycle, roles, unique invoice numbers |
| `appointments.e2e-spec.ts` | dentist / room / patient clashes, blocked time, hours, booking and move races, series, status lifecycle and its races |
| `patients.e2e-spec.ts` | shared family email, archive with cancel, status race, 404 for unknown patients |
| `account-security.e2e-spec.ts` | password reset by email (unknown emails, one-time and expiring links, clinic language, devices signed out), two-factor setup / sign-in / codes once / backup codes / trusted devices / off, required for admins with setup at sign-in and admin reset, device list and single sign-out, admin sign-out everywhere, audit without secrets |
| `audit.e2e-spec.ts` | who / when / IP for every write, old → new values (patient details one level deep, tooth, invoice amounts in a USD clinic, settings, staff role, catalogue price, reschedule), masked photo, sign-ins and failed ones, document views, nothing for reads / refresh / failed writes, filters and paging, who may read it, tenancy, entries cannot be changed |
| `family.e2e-spec.ts` | guardians as linked patients or contacts, main contact, edit / remove / promote, refusals (self, twice, loops, too many, no phone, other clinic, renaming a linked one), children and siblings, family account and one payment over the family's invoices with the rest to credit, roles, tenancy, audit |
| `fiscal.e2e-spec.ts` | fiscal receipt numbers: with the payment and later, one number for a multi-invoice payment, duplicates refused, change / clear, validation, mistakes left out and refunds flagged, the day report's count, date filter, roles, tenancy, audit |
| `documents.e2e-spec.ts` | upload and download with identical bytes, type from the file's bytes (PNG / PDF / DICOM, a renamed program refused), empty and oversize files, teeth and kind checks, filters, who may edit and remove, removal keeps the file, tenancy — files go to a temporary `UPLOAD_DIR` removed afterwards |
| `cash-report.e2e-spec.ts` | day report totals, per method and cashier, mistakes left out, refunds on their day, closing / double close / change after closing / reopen, debtors net of credit with age groups and filters, roles, tenancy |
| `account.e2e-spec.ts` | patient account: oldest-first allocation, explicit splits and their validation, advance payments, applying / splitting / returning / refunding credit, statement order and balance, reports adding up, concurrent payments and credit use, roles, tenancy |
| `reminders.e2e-spec.ts` | settings and secrets, children's reminders to the main guardian (F8), Telegram linking and /stop, the day-before and hours-before runs (channels, opt-out, blocked bot, failures, never twice, never at night or for late bookings), the clinic template, Telegram confirm / cancel buttons, tenancy, test messages — against a local fake Telegram / Twilio |
| `schedule-slots.e2e-spec.ts` | free start times (hours, blocked time, dentist / room / patient bookings, own time when moving, day off, no hours, past times), validation, tenancy, moving between rooms and clearing the room, calendar by room |
| `treatment-plans.e2e-spec.ts` | roles, draft items and totals, present → accept (per item) → done → completed, invoice = estimate, stale acceptance, accept race, revise, decline, cancel, duplicate, tenancy |

The smoke suites in `test/smoke/` overlap with these; they run against an
already running API and are handy for checking a deployed environment.
