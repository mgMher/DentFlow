# API smoke tests

End-to-end checks against a **running** backend. They create clinics, staff,
patients and appointments, so run them only against a throwaway local
database — never against Atlas or production.

```bash
# once: local MongoDB (brew services start mongodb-community) and demo data
MONGO_URI=mongodb://127.0.0.1:27017/dentflow_local npm run seed

# start the API on the local database
npm run build && MONGO_URI=mongodb://127.0.0.1:27017/dentflow_local node dist/main

# in another terminal
npm run test:smoke            # all suites
node test/smoke/03-appointments-schedule.mjs   # one suite
```

| Suite | Covers |
|---|---|
| `01-auth-tenancy.mjs` | login errors, cross-clinic isolation, sessions (rotation, reuse, devices, logout), change/reset password, lockout, clinic settings, rooms, roles |
| `02-patients-staff.mjs` | shared emails, search, duplicates, null handling, roles, upcoming-appointment cancel, staff guards, stats, body limits |
| `03-appointments-schedule.mjs` | clashes (dentist/room/patient), hours, blocked time, availability, status rules, cancel, reschedule, calendar, recurring series, concurrency, blocked-time roles |
| `04-dental-treatments.mjs` | FDI chart, per-surface findings, chart roles, chart-type archive/restore, planned → done updates the chart, catalogue defaults, multi-tooth and no-tooth entries, void, history filters, concurrent edits, catalogue paging/codes/clearing/reactivate, tenancy |
| `05-billing.mjs` | totals and integer money, clinic currency, draft → issued → paid, payment race and exact balance, refunds, cancel rules, invoice numbers under concurrency, roles, search/overdue, billing treatment entries (no double billing), patient summary, tenancy, USD cents |
| `06-reports-dashboard.mjs` | dashboard for every role, one revenue definition (collected, refunds out), clinic-timezone days and inclusive end date, zero-filled day/week/month periods, range validation, appointment rates, dentist performance and treatment revenue that add up, dentists see their own without money, USD cents |
| `07-notifications.mjs` | who is told about bookings, series, reschedules, confirmations, cancellations (one, series, patient archived, dentist deactivated), payments and refunds; never the actor, never inactive staff; own notifications only (read, delete, other clinic), isRead filter, paging, read all, delete read |

Notes:
- Suites 01 and 02 log in as the seeded demo clinic (`admin@ararat-dental.am`); 03 to 07 register their own clinics (06 and 07 register two).
- Registration is rate-limited to 5 per IP per hour (in memory). Restart the API between full runs.
- A suite exits non-zero when any check fails, so it can run in CI later.
