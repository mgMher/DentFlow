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

| File | Covers |
|---|---|
| `auth.e2e-spec.ts` | forged, expired and wrong-secret tokens, stale role, refresh rotation and reuse detection, tabs refreshing at once, logout / logout-all, change password, deactivation, demotion, lockout, register rate limit |
| `tenant-isolation.e2e-spec.ts` | another clinic cannot read, change or reference any record by id in the URL or the body; nothing leaks into its lists and reports |
| `payments.e2e-spec.ts` | parallel payments never overpay, parallel voids, pay vs void, pay vs cancel, edit vs issue, invoice status lifecycle, roles, unique invoice numbers |
| `appointments.e2e-spec.ts` | dentist / room / patient clashes, blocked time, hours, booking and move races, series, status lifecycle and its races |
| `patients.e2e-spec.ts` | shared family email, archive with cancel, status race, 404 for unknown patients |
| `account.e2e-spec.ts` | patient account: oldest-first allocation, explicit splits and their validation, advance payments, applying / splitting / returning / refunding credit, statement order and balance, reports adding up, concurrent payments and credit use, roles, tenancy |
| `reminders.e2e-spec.ts` | settings and secrets, Telegram linking and /stop, the day-before and hours-before runs (channels, opt-out, blocked bot, failures, never twice, never at night or for late bookings), the clinic template, Telegram confirm / cancel buttons, tenancy, test messages — against a local fake Telegram / Twilio |
| `schedule-slots.e2e-spec.ts` | free start times (hours, blocked time, dentist / room / patient bookings, own time when moving, day off, no hours, past times), validation, tenancy, moving between rooms and clearing the room, calendar by room |
| `treatment-plans.e2e-spec.ts` | roles, draft items and totals, present → accept (per item) → done → completed, invoice = estimate, stale acceptance, accept race, revise, decline, cancel, duplicate, tenancy |

The smoke suites in `test/smoke/` overlap with these; they run against an
already running API and are handy for checking a deployed environment.
