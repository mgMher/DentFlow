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

Notes:
- Suites 01 and 02 log in as the seeded demo clinic (`admin@ararat-dental.am`); 03, 04 and 05 register their own clinics.
- Registration is rate-limited to 5 per IP per hour (in memory). Restart the API between full runs.
- A suite exits non-zero when any check fails, so it can run in CI later.
