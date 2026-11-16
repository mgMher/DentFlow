# DentFlow — Manual Test Cases

Living checklist. Add rows as we change things; run it once the project is cleaned up.

**Status key:** `—` not tested · `PASS` · `FAIL` (write what happened) · `N/A`

---

## 0. Setup before testing

These preconditions are easy to miss and cause false failures.

| # | Precondition | Why it matters |
|---|---|---|
| S1 | Backend running (`nest start --watch`, port 8000) and frontend (`react-scripts start`, port 3000) | — |
| S2 | You are logged in to a clinic | Everything is scoped by `clinicId` from the JWT |
| S3 | **At least one user with role `dentist`** exists (Staff page) | The treatment form and blocked-time dialog have empty dentist pickers otherwise |
| S4 | **At least one treatment** exists in the catalogue (Treatments page) with a price | The "Select from catalogue" dropdown is empty otherwise, and price auto-fill can't be tested |
| S5 | At least one patient with a **completed** appointment | Needed for `lastVisit` and the billing/appointment tabs |
| S6 | Test in all three languages (hy / ru / en) | Several bugs were untranslated hardcoded labels |

> The seed script (`npm run seed`) now only replaces its own demo clinic ("Ararat Dental") and
> refuses to run with `MODE=PROD`. It still connects to whatever `MONGO_URI` points at — check it first.

### Already verified (no need to retest)

| Check | Result |
|---|---|
| Backend route table — all new endpoints resolve, removed one 404s | PASS |
| `/schedule/blocked` returns 404, `/schedule/blocked-times` resolves | PASS |
| Frontend bundle contains all new code | PASS |
| `tsc --noEmit` clean on backend and frontend | PASS |
| Production build: **`Compiled successfully`, zero lint warnings** | PASS |
| Exception filter active — errors return `{statusCode, message, path, timestamp}` | PASS |
| Validation errors arrive as one readable string, not an array | PASS |
| No credentials left anywhere in backend source | PASS |

---

## 1. Patients — create form

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| PAT-01 | Required fields marked | Open **Patients → Add Patient** | `*` on First name, Last name, Date of birth, Phone, Gender. Subtitle says fields marked `*` are required | — |
| PAT-02 | Required validation | Submit empty form | Inline errors under each required field; nothing sent | — |
| PAT-03 | Armenian phone — valid formats | Enter `+374 93 12 34 56`, then `093123456`, then `93123456` | All three accepted; saved patient shows `+374 93 12 34 56` | — |
| PAT-04 | Armenian phone — rejected | Enter `123`, `+7 999 1234567`, `abc` | Error "Enter an Armenian number, e.g. +374 93 123456"; cannot save | — |
| PAT-05 | Emergency phone validated too | Fill emergency name + phone `123` | Same Armenian phone error on that field | — |
| PAT-06 | Emergency phone optional | Leave emergency block empty | Saves fine, no error | — |
| PAT-07 | Email unique per clinic | Create patient with an email already used by another patient in this clinic | 409 error toast, **translated** into the current UI language | — |
| PAT-08 | Email optional | Create patient with no email | Saves; list shows `-` | — |
| PAT-09 | Duplicate warning | Enter first name + last name + DOB matching an existing patient | Yellow "Possible duplicate" banner appears with a clickable link to that patient | — |
| PAT-10 | Duplicate warning is not a block | With the banner showing, press Save | Patient is created anyway (twins / same-name people are legitimate) | — |
| PAT-11 | Duplicate warning clears | Change the DOB to something else | Banner disappears | — |
| PAT-12 | DOB in the future | Pick tomorrow's date | Error "Date cannot be in the future"; date picker also caps at today | — |
| PAT-13 | Chip inputs | Conditions / Allergies / Medications | **No "Press Enter to add" helper text.** `+` button adds; Enter adds; comma adds; chip has an × to remove | — |
| PAT-14 | Long chip wraps | Add a very long condition name | Chip wraps to multiple lines, no horizontal scroll | — |
| PAT-15 | Photo upload | Upload a JPG | Avatar shows the photo, cropped square | — |
| PAT-16 | Photo — bad type | Try uploading a `.pdf` or `.gif` | Error "Only JPG, PNG and WebP images are supported" | — |
| PAT-17 | Photo remove | Click the delete badge on the avatar | Reverts to initials | — |
| PAT-18 | Internal notes | Fill "Internal Notes" and save | Saved and shown on the patient's profile tab | — |
| PAT-19 | Translated labels (hy/ru) | Switch language, open the form | **Relationship**, City, State/Province, Postal Code, Country, Street, Provider, Policy Number, Group Number, Expiration Date, Conditions all translated — no English left | — |

---

## 2. Patients — list page

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| PAT-20 | Stat row | Open Patients | Three cards: Total patients / Active / New this month, with real numbers | — |
| PAT-21 | Total count | Compare "Total patients" to actual count | Matches | — |
| PAT-22 | Pagination labels | Look at the bottom of the table | "Rows per page" and "1–20 / 45" **translated**, not English | — |
| PAT-23 | Page size 100 | Open the rows-per-page dropdown | Options 10 / 20 / 50 / 100 | — |
| PAT-24 | Paging works | Go to page 2 and back | Different patients each page; count stays correct | — |
| PAT-25 | Search by name | Type a last name | List narrows after ~400ms; resets to page 1 | — |
| PAT-26 | Search by phone | Type `093 12` or `93123456` | Matches patients whose stored phone is `+37493123456` | — |
| PAT-27 | Search by email | Type part of an email | Matches | — |
| PAT-28 | Search special chars | Type `(` or `+` | No crash, no error (regex is escaped) | — |
| PAT-29 | Status filter | Filter by Inactive / Archived / Deceased | Only that status shown | — |
| PAT-30 | Empty — filtered | Filter to a status with no patients | "No patients match your filters" + **Reset** button (not "Add Patient") | — |
| PAT-31 | Reset clears | Click Reset | Search and status cleared, full list back | — |
| PAT-32 | Empty — genuinely none | (new clinic) | "No patients found" + Add Patient action | — |
| PAT-33 | Action icons | Look at the Actions column | **Eye (view), pencil (edit), ⋮ (status)** — pencil goes to `/patients/:id/edit` | — |
| PAT-34 | Photo in list | Patient with a photo | Row avatar shows the photo, not initials | — |
| PAT-35 | Phone formatted | Any patient | Shows `+374 93 12 34 56`, not `+37493123456` | — |
| PAT-36 | Status chip | Rows with different statuses | Colour-coded and translated | — |
| PAT-37 | Filters survive a status change | Search something, change a patient's status via ⋮ | List reloads **keeping your search and page**, not resetting to page 1 unfiltered | — |

---

## 3. Patients — detail page

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| PAT-40 | Loads | Click a patient | Profile with photo, age, formatted phone, email | — |
| PAT-41 | **Stale patient guard** | Open patient A, go back, immediately open patient B | Never shows A's data (especially A's allergies) under B's URL — spinner, then B | — |
| PAT-42 | Not found | Navigate to `/patients/000000000000000000000000` | "Patient not found" + Back button — **not an infinite spinner** | — |
| PAT-43 | **Allergy banner** | Patient with allergies | Red banner above the tabs listing every allergy as a chip | — |
| PAT-44 | No allergies | Patient without allergies | No banner | — |
| PAT-45 | **No horizontal scroll** | Patient with long medical history / long notes / long email | Page does not scroll sideways; text wraps | — |
| PAT-46 | Insurance labels | Switch to hy/ru | Provider / Policy # / Group # / Expires translated | — |
| PAT-47 | Edit button | Click Edit | Goes to the edit page **without the `Cannot read properties of undefined (reading 'length')` crash** | — |
| PAT-48 | Appointments tab | Open it | Loads this patient's appointments, **newest first** — not empty | — |
| PAT-49 | Billing tab | Open it | Loads this patient's invoices — not empty when they exist | — |
| PAT-50 | Internal notes shown | Patient with notes | "Internal Notes" card on the profile tab | — |
| PAT-51 | Tabs on narrow window | Shrink the window | Tabs scroll, no page overflow | — |

---

## 4. Patients — status & audit trail

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| PAT-60 | Status dropdown | Detail page header | Dropdown with Active / Inactive / Archived / Deceased | — |
| PAT-61 | Change with reason | Pick Archived, type a reason, confirm | Status changes; success toast | — |
| PAT-62 | Cancel | Pick a status, then Cancel | Nothing changes; reason box cleared next time | — |
| PAT-63 | **Audit trail** | After PAT-61, scroll the profile tab | "Status History" card: `Active → Archived`, timestamp, **your name**, the reason underneath | — |
| PAT-64 | Trail accumulates | Change status twice more | Three entries, newest first | — |
| PAT-65 | Registration entry | Create a **new** patient, open it | Trail shows a "Registered → Active" entry with your name | — |
| PAT-66 | Existing patients | Open a patient created before this change | No Status History card (trail starts from the next change — history is not invented) | — |
| PAT-67 | Same status = no entry | Re-select the status the patient already has | No new trail entry, no toast spam | — |
| PAT-68 | Status via edit page | Change status on the **edit form** and save | Trail records it too (not just the dropdown) | — |
| PAT-69 | Status from the list | Use the ⋮ menu on the list | Works, with reason box; trail records it | — |
| PAT-70 | Reactivate | Set back to Active | Trail shows `Archived → Active` | — |

---

## 5. Patients — edit form

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| PAT-80 | Prefilled | Open Edit | Every field filled from the patient, chips present, photo shown | — |
| PAT-81 | **No crash** | Open Edit on a patient with no conditions/allergies/medications | Loads normally (this used to throw) | — |
| PAT-82 | **Clear patronymic** | Delete the patronymic, save | Patronymic is **actually gone** after reload | — |
| PAT-83 | **Clear emergency contact** | Delete the emergency contact name, save | Whole emergency block removed | — |
| PAT-84 | **Clear insurance** | Delete the insurance provider, save | Whole insurance block removed | — |
| PAT-85 | **Clear email** | Delete the email, save | Email removed; another patient can now use it | — |
| PAT-86 | Clear photo | Remove photo, save | Photo gone after reload | — |
| PAT-87 | Clear address | Empty all address fields, save | Address cleared | — |
| PAT-88 | Email conflict on edit | Change email to one another patient uses | Translated 409 error; not saved | — |
| PAT-89 | Own email kept | Save without changing the email | No false "email taken" error | — |
| PAT-90 | Wrong-patient guard | Go from editing A straight to editing B | Never shows A's values in B's form | — |

---

## 6. Dental chart (patient detail → chart tab)

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| DEN-01 | Chart loads | Open the chart tab | Odontogram renders, no `Cannot GET /api/dental-records/.../history` error | — |
| DEN-02 | Tooth click | Click a tooth | Drawer opens with that tooth's status, surfaces, notes | — |
| DEN-03 | Save status | Change "Whole tooth" to Crown, save | Tooth gets a coloured outline and the mark under it | — |
| DEN-04 | **Status history** | Reopen the same tooth | "Status History" shows `Healthy → Filled`, timestamp | — |
| DEN-05 | **History accumulates** | Change to Crown, then Root canal | Three entries, newest first — **old status is not lost** (this was the main bug) | — |
| DEN-06 | Notes in history | Change status with a note | Note appears under the entry | — |
| DEN-07 | Surfaces | Tooth drawer → surface diagram | Centre is Occlusal (molars/premolars) or Incisal (front teeth); sides Mesial / Distal / Buccal / Lingual or Palatal; bar = Cervical — hover names, all translated | — |
| DEN-08 | Legend | Below the chart | Whole-tooth statuses (outline + mark) and surface findings (fill), translated | — |
| DEN-09 | Drawer on narrow window | Shrink the window | Drawer is full width, no page overflow | — |

### Record treatment (new form)

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| DEN-20 | Form present | Tooth drawer → "Record Treatment" | Collapsible section opens | — |
| DEN-21 | Catalogue autofill | Pick a treatment from the dropdown | Name **and price + currency** auto-fill from the catalogue | — |
| DEN-22 | Custom treatment | Leave the catalogue empty, type a name | Accepted | — |
| DEN-23 | Name required | Submit with an empty name | Inline required error | — |
| DEN-24 | Dentist default | Open the form as a dentist | Your own name preselected | — |
| DEN-25 | Dentist choice | Pick another dentist | Accepted | — |
| DEN-26 | Date | Defaults to today; try a future date | Done: future blocked. Planned: future allowed | — |
| DEN-27 | Surfaces prefilled | Tooth has caries on some surfaces | Those surfaces ticked in the treatment form | — |
| DEN-28 | Save | Fill and submit | Success toast; form collapses and clears | — |
| DEN-29 | **Appears in history** | Look at "Treatment History" below | New entry with name, date, **dentist name and cost** | — |
| DEN-30 | Currency | Clinic currency vs catalogue currency | Cost shows with the right symbol (֏ / $ / ₽) | — |
| DEN-31 | Empty state | Tooth with no treatments | "No treatments recorded for this tooth" | — |

### Pediatric charts

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| DEN-40 | Child default | Create a patient **under 13**, open the chart tab | Chart created as **primary teeth** — 20 teeth, FDI 55…51 / 61…65 over 85…81 / 71…75 | — |
| DEN-41 | Adult default | Patient 13 or older | 32 teeth, FDI 18…11 / 21…28 over 48…41 / 31…38 | — |
| DEN-42 | Toggle present | Above the chart | Adult / Child toggle showing the current type | — |
| DEN-43 | Switch warns | Click the other type | Confirm dialog says the current chart is kept and comes back on switching again | — |
| DEN-44 | Switch works | Confirm | Teeth renumber; drawer closes | — |
| DEN-45 | Treatments survive | After switching, check a recorded treatment | Treatment entries still exist (separate collection) | — |
| DEN-46 | Cancel switch | Open the dialog, cancel | Nothing changes; toggle stays put | — |
| DEN-47 | Existing chart unchanged | Open an existing adult chart | Still adult — the age hint only applies at creation | — |

---

## 7. Appointments (fixed alongside)

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| APP-01 | **Detail page loads** | Patient → Appointments tab → click a row | Opens **without** `Objects are not valid as a React child (found: object with keys {_id, name})` | — |
| APP-02 | Room shows | Appointment with a treatment room | Room **name** shown, not blank | — |
| APP-03 | Treatments render | Appointment with treatments attached | Chips show treatment **names** | — |
| APP-04 | **Dentist shows** | Appointment list and detail | Real dentist name, **not `-`** | — |
| APP-05 | Dentist on new appointment | Create an appointment, then open it | Dentist name shows correctly | — |
| APP-06 | Dentist filter | Filter the list by dentist | Actually filters (used to match nothing) | — |
| APP-07 | Phone formatted | Appointment detail | Patient phone as `+374 93 12 34 56` | — |
| APP-08 | **lastVisit** | Mark an appointment Completed, go to Patients | That patient's "Last Visit" column is no longer `-` | — |

---

## 8. Schedule — blocked times (fixed alongside)

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| SCH-01 | **Create works** | Schedule → Blocked Times → Add | Saves (used to hit a 404 and fail silently) | — |
| SCH-02 | Dentist required | Leave the dentist empty | Inline error | — |
| SCH-03 | Reason is a dropdown | Open the reason field | **Dropdown**: Break / Lunch / Vacation / Personal / Meeting / Other — translated. Not a free-text box | — |
| SCH-04 | Note field | Fill "Note" | Saved and shown under the reason in the table | — |
| SCH-05 | End after start | Set end before start | Error "End time must be after start time" | — |
| SCH-06 | List shows dentist | After creating | Dentist column populated, reason translated | — |
| SCH-07 | Delete | Delete a blocked time | Removed from the list | — |
| SCH-08 | No dentists | Clinic with no dentist users | Info message and Save disabled — no confusing failure | — |
| SCH-09 | Timezone | Create at 14:30, reload | Still 14:30, not shifted | — |

---

## 9. Startup migrations (check the backend log once)

Restart the backend and read the console.

| ID | What to test | Expected log | Status |
|---|---|---|---|
| MIG-01 | Patient status backfill | `Backfilled status for N patient(s)` (or nothing if already done) | — |
| MIG-02 | Phone normalization | `Normalized N patient phone number(s) to +374XXXXXXXX` | — |
| MIG-03 | Unparseable phones listed | Warning listing patient ids whose phones need fixing by hand | — |
| MIG-04 | Appointment dentist repoint | `Repointed dentistId on N appointment(s) from UserProfile to auth User` | — |
| MIG-05 | Idempotent | Restart again | No counts reported the second time | — |
| MIG-06 | Unique email index | No index error in the log | Index built. **If it errors**, two patients in one clinic share an email — see the duplicate query below | — |

Find same-clinic duplicate emails (`mongosh`):

```js
db.patients.aggregate([
  { $match: { email: { $type: "string", $gt: "" } } },
  { $group: { _id: { clinicId: "$clinicId", email: "$email" }, n: { $sum: 1 }, ids: { $push: "$_id" } } },
  { $match: { n: { $gt: 1 } } }
])
```

---

## 10. Cross-cutting

| ID | What to test | Expected | Status |
|---|---|---|---|
| GEN-01 | Console clean | Click through every patient screen | No red errors in DevTools console | — |
| GEN-02 | No horizontal scroll | Every patient screen, narrow and wide | Page never scrolls sideways | — |
| GEN-03 | All three languages | Switch hy / ru / en on every patient screen | No raw keys (`patients.something`), no English left in hy/ru | — |
| GEN-04 | Translated API errors | Trigger a duplicate email in hy and ru | Error toast in that language, not English | — |
| GEN-05 | Language label | Language switcher | Armenian reads `Հայերեն` (was `Հայerror`) | — |
| GEN-06 | Multi-clinic isolation | Two clinics, same patient email | Both allowed; neither sees the other's patients | — |

---

## 11. Project cleanup — regression checks

⚠️ **Highest priority.** `TransformInterceptor` and `GlobalExceptionFilter` existed in the
codebase but were **never registered**. Registering them changes the response shape for
*every* endpoint in the app. The whole client was already written against the
`{ statusCode, message, data }` envelope, so this fixes things — but it needs a pass over
each module, not just patients.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| CLN-01 | **Patient list total** | Have more patients than one page. Look at pagination | `1–20 of 45` with the **real** total, and more than one page. Before the fix `total` fell back to the page length, so it always showed the current page's count and one page | — |
| CLN-02 | Other list totals | Treatments, Staff, Billing, Notifications pages | Pagination totals correct on each (all had `total: data.total \|\| 0` → `0`) | — |
| CLN-03 | Login still works | Log out, log in | Works — the login response is now wrapped | — |
| CLN-04 | Token refresh | Leave the app until the token expires, then act | Silently refreshes, no logout loop | — |
| CLN-05 | Every list still loads | Open every page in the sidebar | Data appears everywhere — nothing shows an empty list from mis-unwrapping | — |
| CLN-06 | Error toasts readable | Trigger any API error | Real message, **not** `[object Object]` or `undefined` | — |
| CLN-07 | Validation errors | Submit a form the server rejects | One readable sentence, e.g. `email must be an email, password should not be empty` | — |
| CLN-08 | Localized error codes | Duplicate email in hy/ru | Still translated — the filter preserves the `code` field | — |
| CLN-09 | Unread notification count | Header bell | Correct number | — |
| CLN-10 | Backend reads `.env` | Restart the backend | Connects fine — URI now comes from `backend/.env`, not hardcoded in `app.module.ts` | — |
| CLN-11 | Name consistency | Same patient on Patients, Appointments, Dashboard, Billing | **Identical** name everywhere. Appointment pages previously omitted the patronymic and used a different format | — |
| CLN-12 | Unpopulated refs | Any list where a reference isn't populated | Shows `-`, never a raw ObjectId like `507f1f77bcf86cd799439011` | — |

---

## 12. Phase 0 — foundation (branch `fix/phase-0-foundation`)

**Before testing:** set `JWT_ACCESS_EXPIRATION=15m` in `backend/.env` (it still says `1d`).

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F0-01 | `.env` secrets used | Change `JWT_ACCESS_SECRET` in `backend/.env`, restart, log in | Works. A token signed with `dev-access-secret` (old default) is rejected | — |
| F0-02 | PROD refuses weak secrets | Start with `MODE=PROD` and a 10-char secret | Backend exits at startup with a clear error | — |
| F0-03 | Deactivation is immediate | Admin deactivates staff B while B is logged in; B clicks anything | B is sent to login on the next request (used to keep access up to 24h) | — |
| F0-04 | Demotion is immediate | Change B from admin to receptionist while B is logged in | B's next action silently refreshes; admin-only pages disappear from B's sidebar after reload | — |
| F0-05 | Wrong password message stays | Log in with a wrong password | "Invalid email or password" stays on screen, page does **not** reload | — |
| F0-06 | Same message for unknown email | Log in with an email that has no account | Same message as F0-05 | — |
| F0-07 | Parallel refresh | Wait 15+ min (token expired), open the Dashboard (several requests at once) | Page loads; you are **not** logged out | — |
| F0-08 | Reload keeps the user | Log in as admin, press F5 on Staff detail | Avatar shows initials (not "?"), admin buttons still visible | — |
| F0-09 | Logout revokes | Log out, then reuse the old refresh token (`POST /api/auth/refresh`) | 401 | — |
| F0-10 | Bad id = 400 | Open `/appointments/abc`, `/billing/abc` | Translated error, not "Internal server error" | — |
| F0-11 | Cross-clinic patient blocked | Clinic A: `POST /api/appointments` with a patientId from clinic B | 404 "Patient not found"; nothing created | — |
| F0-12 | Cross-clinic dentist blocked | Same with clinic B's dentistId; also on invoices and treatment entries | 404 | — |
| F0-13 | Deceased patient | Try to book or invoice a deceased/archived patient | Shown greyed out in the picker; API refuses with a translated message | — |
| F0-14 | Patient picker search | Clinic with 25+ patients: book patient #25 by typing part of the name or phone | Found and bookable (used to show only the first 20) | — |
| F0-15 | Invoice patient picker | Billing → New invoice | Patient search works (list used to be empty) | — |
| F0-16 | Translated errors | In hy and ru, trigger a failed save on any page | Error in that language, not English | — |
| F0-17 | No repeated toasts | Save a treatment, then save a patient | One toast each; the old toast does not reappear | — |
| F0-18 | Second save toasts | Save the same treatment twice | Two toasts (the second used to be silent) | — |
| F0-19 | Role gating | Log in as receptionist | No Reports / Settings in the sidebar; typing `/settings` lands on Dashboard | — |
| F0-20 | Profile load failure | Stop the backend, reload the app | "Could not load your profile" + Try again button, not an endless spinner | — |
| F0-21 | "Today" after midnight | Set the computer clock to 01:00, open Record treatment / new patient | Today's date is selectable and is the default | — |
| F0-22 | Duplicate value | Create two treatment rooms or records that hit a unique index at the same time | 409 translated "already exists", not 500 | — |
| F0-23 | Seed is scoped | Run `npm run seed` on a DB with another clinic | Other clinic untouched; seeded users can log in | — |

## 13. Phase 1 — auth & clinic settings

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F1-01 | Founder in staff list | Register a new clinic, open Staff | The founder is listed as admin | — |
| F1-02 | Founder backfill | Restart backend on a DB with clinics registered before this change | Log: `Created staff profiles for N account(s)`; those founders appear in Staff | — |
| F1-03 | New clinic has a catalogue | Register, open Treatments | Default treatments present | — |
| F1-04 | Duplicate email on register | Register with an email that already has an account | Translated "account with this email already exists"; no orphan clinic in DB | — |
| F1-05 | Register password rule | Password of 7 characters | Inline "min 8" error; API also refuses | — |
| F1-06 | Lockout | 5 wrong passwords for one account | 6th attempt: "Too many failed attempts. Try again in 15 min…" even with the right password | — |
| F1-07 | Lockout cleared by reset | Admin resets that member's password | Member can log in immediately with the new password | — |
| F1-08 | Two devices | Log in on Chrome and Firefox with the same account; use both for 20+ min | Both stay signed in (used to kick each other out) | — |
| F1-09 | Two tabs refresh | Two tabs open, wait 15+ min, click in both quickly | Neither is logged out | — |
| F1-10 | Logout one device | Log out in Chrome | Firefox stays signed in | — |
| F1-11 | Log out everywhere | Profile menu → Sign out of all devices | Every device is sent to login on its next action | — |
| F1-12 | Change password | Profile menu → Change password; wrong current password | Inline translated error, dialog stays open | — |
| F1-13 | Change password OK | Correct current + new | Toast; this device stays signed in; other devices are signed out | — |
| F1-14 | Admin reset | Staff → member → Reset password | Toast; member signed out everywhere; old password no longer works | — |
| F1-15 | No reset for self | Open your own staff page as admin | No "Reset password" button | — |
| F1-16 | Forgot password | Login → "Forgot password?" | Hint to ask the administrator | — |
| F1-17 | Empty clinic email | Freshly registered clinic → Settings → Save profile without email | Saves (used to fail "email must be an email") | — |
| F1-18 | Clinic phone | Enter `123` | Inline error, Save disabled; `093123456` saves as `+37493123456` | — |
| F1-19 | Working hours | Set Monday 18:00–09:00 | Inline error, Save disabled; API also refuses | — |
| F1-20 | Edit room | Settings → Rooms → edit name | Saved (used to fail with 400) | — |
| F1-21 | Deactivate / activate room | Deactivate a room, then activate it | Confirm text explains effect; room greyed with "Inactive" chip; activate restores it | — |
| F1-22 | Dialog keeps input on error | Make a room save fail (e.g. stop backend) | Dialog stays open with your text | — |
| F1-23 | Settings load failure | Stop backend, open Settings | Error + Retry, no forms with default hours | — |
| F1-24 | Regional tab | Settings → Language & currency | No dark-mode switch; changing the default language does **not** change your UI language | — |
| F1-25 | Timezone list | Open the timezone select | Full IANA list; current value selected | — |
| F1-26 | Subscription not editable | `PATCH /api/clinics/current` with `{"subscription":{"status":"active"}}` | 400 (property should not exist) | — |
| F1-27 | Suspended clinic | Set `isActive:false` on a clinic in DB | Within a minute its users get "clinic's account is suspended" | — |
| F1-28 | Rate limit | 31 logins from one IP within a minute | 31st: "Too many attempts" (429) | — |
| F1-29 | Sign in once after deploy | Existing logged-in user after upgrading | Sent to login once, then normal | — |

## 14. Data repair (check the backend log once, on each existing database)

| ID | What to test | Expected | Status |
|---|---|---|---|
| MIG-07 | ObjectId repair | First start logs `Converted string ids to ObjectIds in N <collection> document(s)` (or nothing); a `migrations` document `2026-10-28-objectid-repair` exists | — |
| MIG-08 | Runs once | Restart again | No repair log line | — |
| MIG-09 | Old data visible | Patients/appointments/invoices created through the app **before** this change | Listed, searchable, bookable and billable | — |
| MIG-10 | No string ids left | `mongosh`: count `{clinicId: {$type: "string"}}` in every collection | 0 | — |

## 15. Phase 2 — patients & staff

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F2-01 | Shared email | Create two patients (siblings) with the same email | Both saved; the second shows the "possible duplicate" warning, not an error | — |
| F2-02 | Duplicate by phone | New patient, type an existing patient's phone as `077…` | Warning lists that patient; link opens in a new tab, form kept | — |
| F2-03 | Duplicate on edit | Edit a patient | Never warns about itself | — |
| F2-04 | Full-name search | Patients list: search "Firstname Lastname" | Finds the patient | — |
| F2-05 | Search keeps focus | Type a search that returns nothing, keep typing | Search box stays, no page spinner | — |
| F2-06 | Emergency contact | Fill emergency phone, leave name empty, save | Inline error on the name | — |
| F2-07 | Insurance | Fill policy number, leave provider empty, save | Inline error on the provider | — |
| F2-08 | No status on edit form | Edit patient | No status select; status only via the patient page | — |
| F2-09 | Archive with appointments | Patient with booked future visits → Archived | Dialog says "N upcoming appointments", cancel ticked; after confirm they show Cancelled | — |
| F2-10 | Inactive keeps appointments | Same, choose Inactive | Cancel option unticked by default | — |
| F2-11 | Archived not bookable | Book an archived patient | Greyed out in the picker; API refuses | — |
| F2-12 | Receptionist | Log in as receptionist, edit a patient | Medical history fields read-only with an explanation; no status select; can change phone | — |
| F2-13 | Assistant | Log in as assistant | Patients readable; no Add / Edit / status buttons | — |
| F2-14 | Staff list roles | Non-admin opens Staff | No "Add staff", no status menu | — |
| F2-15 | Deactivate dentist | Dentist with booked visits → Deactivate | Dialog shows count and an opt-in to cancel them | — |
| F2-16 | New staff hours | Add a dentist | Working hours prefilled from the clinic's opening hours | — |
| F2-17 | Old specialization | Staff member with free-text specialization | Shown in the select (disabled option) instead of blank | — |
| F2-18 | Stats after status change | Archive from the list page | Stat cards update without reload | — |
| F2-19 | Startup log | Restart backend twice | Fixes log at most once; `migrations` collection lists them | — |

## 16. Phase 3 — appointments & schedule

Set the clinic's working hours first (Settings → Working hours), e.g. Mon–Fri 09:00–18:00.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F3-01 | Calendar shows visits | Month with appointments | They appear in their day cells (used to be empty) | — |
| F3-02 | Filters | Filter by status / dentist; switch to List | Both views filtered; list paginates past 20 | — |
| F3-03 | Free time | New appointment → pick dentist and a working day | Chips "09:00 – 18:00" minus bookings/blocks, in local time | — |
| F3-04 | Treatments set duration | Pick a 60-min treatment | Duration becomes 60 min (until you change it by hand) | — |
| F3-05 | Dentist clash | Book the same dentist at an overlapping time | "The dentist already has an appointment at this time" | — |
| F3-06 | Patient clash | Same patient with another dentist at the same time | "The patient already has an appointment…" | — |
| F3-07 | Room clash | Same room, other dentist and patient | "The room is already booked…" | — |
| F3-08 | Back-to-back | 09:00–09:30 then 09:30–10:00 | Both saved | — |
| F3-09 | Outside hours | Book 19:00 | Warning with **Book anyway**; that button saves it | — |
| F3-10 | Blocked time | Block 12–13, book 12:15 | Refused even with Book anyway | — |
| F3-11 | Block over bookings | Block a time that has a booked visit | Saved, with a warning to move the visit | — |
| F3-12 | Future visit actions | Open a visit next week | Only Confirm / Reschedule / Cancel (no Start / Complete / No-show) | — |
| F3-13 | Walk-in | Visit starting now (scheduled) | Start visit and Mark as completed available | — |
| F3-14 | Completed is final | Complete a visit | No more actions; patient's Last visit updated | — |
| F3-15 | Cancel needs a reason | Cancel a visit | Reason required; shown with note, who and when on the detail page | — |
| F3-16 | Rebook | Cancel, then "Book again at this time" | Works if the slot is still free; refused if someone took it | — |
| F3-17 | Reschedule | Reschedule into a busy time / a free time | Refused / saved; duration updated | — |
| F3-18 | Weekly series | Repeat weekly until in 5 weeks | 5 visits, same local time; toast lists skipped dates if any | — |
| F3-19 | Cancel series | Cancel the 2nd one → "This and all following" | It and all later ones cancelled, earlier kept | — |
| F3-20 | Series limits | Repeat daily for 2 years | Refused ("at most one year"); daily for 3 months → max 52, weekends skipped | — |
| F3-21 | Patient tab | Patient page → Appointments | Their visits newest first, paginated, "Book appointment"; Appointments page list unaffected | — |
| F3-22 | Dentist blocks | Log in as dentist → Schedule | Can block only own time; cannot delete a colleague's block | — |
| F3-23 | Assistant | Log in as assistant | Sees calendar and visits; no booking / status / block buttons | — |
| F3-24 | Delete block | Delete a blocked time | Confirmation first | — |
| F3-25 | Room names | Add a room with an existing name (any case) | Translated "already exists" | — |
| F3-26 | Status labels | In progress / no-show chips in hy, ru, en | Translated, never `in_progress` | — |
| F3-27 | After midnight | Clock 01:00, open Appointments | "Today" is today; free time correct | — |

## 17. Phase 4 — treatments catalogue & dental chart

Log in as the clinic admin and as a dentist; some rows need a receptionist or assistant too.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F4-01 | FDI layout | Open an adult chart | Upper row 18…11 \| 21…28, lower row 48…41 \| 31…38; "Patient's right" on the left. Lower arch no longer mirrored | — |
| F4-02 | Old charts converted | Existing database, first start after deploy | Log: "Converted N charts/entries to FDI numbering"; a tooth that was #3 is now 16 with the same status and history | — |
| F4-03 | Per-surface findings | Tooth 26: Caries brush → mesial, Filling brush → occlusal, save | Both shown on the tooth; mesial red, occlusal blue | — |
| F4-04 | Clear a surface | Click a marked surface again (or use "Sound") | Surface cleared | — |
| F4-05 | Who changed it | Tooth drawer → status history | Every change shows "Changed by" with a name | — |
| F4-06 | Planned treatment | Record treatment → Planned, catalogue filling, mesial | In the tooth's list as Planned; chart unchanged | — |
| F4-07 | Mark done | "Mark done" on it | Mesial turns from caries to filling, tooth Filled, history "via treatment" | — |
| F4-08 | Catalogue default | Record a done "Simple Tooth Extraction" on 38 | "Tooth becomes" prefilled Missing; 38 crossed out | — |
| F4-09 | No tooth | Patient → Treatments → Add treatment, no teeth (exam) | Saved as "Whole mouth" | — |
| F4-10 | Several teeth | Add a bridge on 14, 15, 16 | One entry; shows in each of those teeth's drawers | — |
| F4-11 | Void | Treatments tab → Void, reason "Wrong patient" | Hidden from the list; "Show voided" shows it struck through with who, when, why | — |
| F4-12 | Void needs a reason | Void with fewer than 3 characters | Confirm disabled | — |
| F4-13 | Switch and back | Mark some teeth, switch to Primary teeth, then back | Primary chart fresh; switching back restores the permanent chart exactly | — |
| F4-14 | Roles | Receptionist / assistant: open chart | "View only"; no Save, no Record treatment, toggle disabled; API returns 403 | — |
| F4-15 | Switch patients | Open patient A's chart, then patient B's | Never shows A's teeth under B | — |
| F4-16 | Two people at once | Two browsers edit different teeth of one chart | Both kept; if a clash remains: "changed at the same time", chart reloads | — |
| F4-17 | Keyboard | Tab to a tooth, press Enter | Drawer opens; screen reader reads "Tooth 26, Filled, Mesial: Filling…" | — |
| F4-18 | Dark mode | Header → dark theme, open chart | Numbers, outlines, surfaces readable | — |
| F4-19 | Catalogue paging | Treatments page | Real total, pages of 20/50/100, search on the server (try `(((`) | — |
| F4-20 | Localized names | Switch UI to hy / ru | Catalogue and pickers show nameHy / nameRu when set | — |
| F4-21 | Deactivate / reactivate | Deactivate an item, filter Inactive, Reactivate | Hidden from pickers while inactive; back after reactivate | — |
| F4-22 | Unique code | Add an item with code `d0150` (exists) | "Another treatment already uses this code" on the code field; dialog stays open | — |
| F4-23 | Clear fields | Edit an item, empty description and Armenian name, save | They are gone after reload | — |
| F4-24 | Catalogue roles | Dentist opens Treatments | List only, "Only the clinic admin can change the catalogue" | — |
| F4-25 | Empty catalogue | Clinic with no items (admin) | "Add the standard catalogue" button creates 20 items | — |

## 18. Phase 5 — billing

Log in as the clinic admin, a receptionist, a dentist and an assistant.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F5-01 | Create from treatments | Patient → Billing → Create invoice → "From treatments", tick two | Lines with the recorded cost, "From the dental chart"; patient pre-filled | — |
| F5-02 | No double billing | Create a second invoice and look at "From treatments" | Already billed treatments are not offered; API refuses them (409) | — |
| F5-03 | Discount % | 20 000 with 10% | Line 18 000; detail page shows "10%" (not "10 ֏") | — |
| F5-04 | Currency | Open the form | Currency is the clinic's, read-only | — |
| F5-05 | Draft → issue | Save as draft; open it; Edit; Issue | Draft editable; after Issue no Edit; payments allowed only after Issue | — |
| F5-06 | Exact balance | Pay the whole remaining amount | Accepted; status Paid, balance 0 | — |
| F5-07 | Overpay | Pay more than the balance | Inline "The remaining balance is …" | — |
| F5-08 | Two cashiers | Two browsers pay the last 5 000 at the same time | One succeeds, the other gets the balance error | — |
| F5-09 | Half a dram | Price or payment 100.5 in an AMD clinic | Refused ("Too many decimals") | — |
| F5-10 | Cancel with payments | Cancel a partly paid invoice | Not offered; API says refund first | — |
| F5-11 | Refund | Admin → payment → Refund / void, reason | Payment struck through with who / when / why; balance back up; status Partly paid / Issued | — |
| F5-12 | Cancel | Admin cancels an issued unpaid invoice with a reason; receptionist cancels a draft | Cancelled with reason shown; its treatments become billable again | — |
| F5-13 | Receptionist limits | Receptionist on an issued invoice | No Cancel (hint shown), no Refund | — |
| F5-14 | Dentist / assistant | Dentist opens Billing; assistant looks for Billing | Dentist: view only, no Create; assistant: no menu item, `/billing` redirects | — |
| F5-15 | Overdue | Issued invoice with yesterday's due date | Red "Overdue" chip, Overdue tab lists it, due date red | — |
| F5-16 | Search | Type a patient's first + last name, then an invoice number | Matches; no 400 on typing | — |
| F5-17 | Numbers | Create several invoices | `INV-2026-00001`, `…00002`, …, never duplicated | — |
| F5-18 | Patient balance | Patient → Billing | Billed / paid / balance ignore drafts and cancelled; "Treatments not billed yet: N" | — |
| F5-19 | Print | Invoice → Print | Only the invoice with the clinic's name/address/phone; no sidebar, header or buttons | — |
| F5-20 | Old data | Existing database, first start after deploy | Log "Converted N invoices/payments to integer amounts"; old USD 12.50 still shows 12.50; `pending` invoices show Issued / Partly paid | — |
| F5-21 | Billed treatment | Void a treatment that is on an invoice | "This treatment is on an invoice. Cancel the invoice first." | — |
| F5-22 | Languages | Billing screens in hy / ru / en | All labels and errors translated | — |

## 19. Phase 6 — reports & dashboard

Log in as the clinic admin, a receptionist, a dentist and an assistant. Have at least one paid, one partly paid and one refunded payment this month.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F6-01 | Dashboard per role | Log in as each role | Opens for everyone (no "Insufficient permissions"). Admin: today, revenue, patients, open invoices. Receptionist/dentist: no revenue card. Assistant: no revenue, no invoices | — |
| F6-02 | Dashboard numbers | Compare with Appointments / Billing | Today's count excludes cancelled; active patients = Patients page "Active"; open invoices + overdue match the Billing tabs | — |
| F6-03 | Month revenue | Admin dashboard vs Reports "This month" | Same amount; refunded payments not counted | — |
| F6-04 | Recent activity | Register a patient, book, take a payment | Newest first with who did it; click opens the patient / appointment / invoice; assistant sees no payments or invoices | — |
| F6-05 | Dentist dashboard | Log in as a dentist | "My appointments today", own upcoming only, no Create invoice button | — |
| F6-06 | Reports — revenue | Reports → This month | Collected / Invoiced / Outstanding / New patients filled; chart has a bar per day (zero days included) | — |
| F6-07 | Grouping | Daily → Weekly → Monthly; presets This year / Last month | Periods start on Mondays / the 1st; totals unchanged; only the revenue request reloads when grouping changes | — |
| F6-08 | Clinic day | Payment at 00:30 Yerevan time | Counted on that day, not the day before; end date included | — |
| F6-09 | Bad range | Start after end | Red fields, "The start date is after the end date", nothing loaded | — |
| F6-10 | Table view | Collected → Table | Same numbers as the chart; hover / focus a bar shows date, amount, payments | — |
| F6-11 | Dentist performance | Admin view | Every active dentist; collected per dentist + "Lines without a dentist" add up to Collected | — |
| F6-12 | Treatments | Admin view | Done count from the chart; collected per treatment; manual lines grouped by name | — |
| F6-13 | Dentist reports | Log in as a dentist → Reports | Own appointments, own row, own treatments; no money anywhere; no 403 in the network tab | — |
| F6-14 | Receptionist / assistant | Look for Reports | No menu item; `/reports` redirects | — |
| F6-15 | USD clinic | Clinic in USD, payments 0.10 + 0.20 | Collected 0.30 (not 30) | — |
| F6-16 | Staff → Performance | Admin opens a dentist; dentist opens own profile | This year's appointments, completion, treatments, collected (admin only); a dentist doesn't see the tab on colleagues | — |
| F6-17 | Languages | Dashboard and Reports in hy / ru / en | All labels, activity lines and month names translated | — |

## 20. Phase 7 — notifications

Two browsers: a receptionist in one, the dentist (or admin) in the other.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F7-01 | Booking | Receptionist books for the dentist | Within a minute (or on switching back to the tab) the dentist's bell shows 1; "New appointment: patient, time"; the receptionist's bell does not move | — |
| F7-02 | Own action | Dentist books for himself | No notification | — |
| F7-03 | Series | Book a weekly series | One notification with the number of visits | — |
| F7-04 | Move | Change the time; then change only the note | Time change: "old → new"; note change: nothing | — |
| F7-05 | Other dentist | Move the appointment to another dentist | Both dentists notified | — |
| F7-06 | Confirm / cancel | Confirm, then cancel with a reason | Dentist gets both; the cancel shows the reason in the reader's language | — |
| F7-07 | Patient archived | Archive a patient with future visits, cancel them | Each dentist gets one notification with the count; click opens the patient | — |
| F7-08 | Dentist leaves | Deactivate a dentist with future visits, cancel them | Admins and receptionists: "Patients to call", with the count | — |
| F7-09 | Payments | Receptionist takes a payment; admin refunds it | Admin told of the payment; receptionist told of the refund with the reason; click opens the invoice | — |
| F7-10 | Privacy | Try `PATCH /notifications/<someone else's id>/read` | 404; their notification unchanged | — |
| F7-11 | Unread tab | Open Unread | Only unread items (the old filter returned read ones too) | — |
| F7-12 | Read | Click an unread item | Marked read in place, bell drops by one, the linked page opens | — |
| F7-13 | Delete | Delete one; "Delete read" | Each asks first; list and bell update | — |
| F7-14 | Paging | More than 20 notifications | Pages of 20; deleting the last item of the last page steps back a page | — |
| F7-15 | Offline | Stop the API for two minutes | No error toast every minute; the bell recovers when the API is back | — |
| F7-16 | Languages | Switch hy / ru / en | Existing notifications re-worded in the new language | — |

## 21. Phase 8 — safety net

### Automated runs (2026-10-30)

| Check | How | Result |
|---|---|---|
| Backend e2e, 121 tests in 5 files (auth/refresh, tenant isolation, payments, appointments, patients) | `cd backend && npm run test:e2e` (needs a local MongoDB; see `test/e2e/README.md`) | PASS |
| API smoke suites 01–07, 341 checks | `test/smoke/README.md` (fresh seed before 01–02, API restart between batches) | PASS |
| Unit tests, 22 | `npm test` | PASS |
| TypeScript `strict`, backend and frontend | `npx tsc --noEmit` in each | PASS |
| Frontend lint | `npx eslint src --ext .ts,.tsx` | PASS |
| Translation audit | every `t('…')` key and every enum-driven key (statuses, reasons, roles, categories, days…) exists in en / hy / ru; no missing or empty keys (except the deliberately blank `dental.short.healthy`); placeholders match; every backend error `code` has `errors.<code>`; no hard-coded English in JSX | PASS |
| Browser walk, hy / ru / en | all 18 routes (lists, detail pages, forms, editor) and their 27 tabs as clinic admin, scanned for raw keys, `undefined` / `NaN` / `Invalid Date`, untranslated text and console errors; Armenian layout checked on invoice and reports | PASS |

> The earlier sections' rows were **not** each clicked through by hand. Their API behaviour is covered
> by the e2e and smoke suites above; rows that are about the UI itself (dialog wording, toasts, focus,
> layout) still need a person. Their Status column is left as it was.

### Bugs found by the new tests (now fixed)

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| F8-01 | Several tabs refresh at once | Open the app in 3 tabs, wait for the access token to expire (or shorten `JWT_ACCESS_EXPIRATION`), then click in all tabs quickly | All tabs stay signed in (it used to revoke the session and sign everyone out) | PASS (e2e) |
| F8-02 | Two moves into one slot | Two receptionists drag/edit two appointments of the same dentist into the same free time at the same moment | At most one succeeds; the other gets "already has an appointment" and stays where it was | PASS (e2e) |
| F8-03 | Move vs new booking | One moves an appointment into a slot while another books that slot | Never both | PASS (e2e) |
| F8-04 | Restore vs new booking | Restore a cancelled appointment while someone books its old slot | Never both; a refused restore stays cancelled with its reason | PASS (e2e) |
| F8-05 | Edit vs cancel | Open the edit dialog, someone else cancels the appointment, save | "Someone else just changed this appointment" — the cancelled appointment is not moved | PASS (e2e) |
| F8-06 | Family email on a new install | On a fresh database, add two children with the same parent email | Both saved (the unique index came back on fresh databases) | PASS (e2e + smoke 02) |
| F8-07 | Unknown patient | Open `/patients/<deleted or other clinic id>` and its tabs | "Patient not found" everywhere — upcoming count, billing summary, unbilled treatments and history used to show empty data | PASS (e2e) |
| F8-08 | Backend log on an existing database | Start the API once | `2026-10-patient-email-not-unique-again` runs once; no index error | — |

## 22. Layout on phones

Log in as the clinic admin. Use the browser's device toolbar at 375×812 (iPhone-sized), then at ≥ 900px wide.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| M-01 | Phone layout | 375px wide, open every menu page plus a patient, staff member and appointment | No sidebar beside the page; content fills the width; no sideways scrolling (wide tables scroll inside their own box) | — |
| M-02 | Menu | Tap ☰ in the header; tap outside the drawer; open it again and tap a menu item | Drawer slides in over a dimmed page; tapping outside or the ‹ button closes it; a menu item opens that page and closes the drawer | — |
| M-03 | Desktop unchanged | ≥ 900px wide; click ‹ / › at the top of the sidebar | No ☰ button; sidebar sits beside the page and collapses to icons and back as before | — |
| M-04 | Print from a phone | 375px wide, print an invoice | Only the invoice prints — no header, no drawer | — |

## 23. F1 — treatment plans

Log in as a dentist; for the acceptance steps also try a receptionist. Use a patient with a free tooth 36.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| P-01 | New plan | Patient → Treatment plans → New plan | Title "Option A", you as the dentist; the plan page opens as a draft | PASS (browser) |
| P-02 | Items | Add a filling on 16 from the catalogue with 10%; a crown on 36 at stage 2; a cleaning (no tooth) | Price filled from the catalogue; line total shown live; table grouped by stage with subtotals; totals = subtotal − discount | PASS (browser) |
| P-03 | Bad input | Price 100.5 in AMD; discount 101; tooth 19 | Refused with a translated message | PASS (e2e) |
| P-04 | Edit / remove | Change the cleaning's price; remove it | Totals follow; removal asks first | — |
| P-05 | Present | Present to patient, keep the default date | Status Presented, valid until +30 days; edit and remove disappear | PASS (browser) |
| P-06 | Print | Print estimate | Clinic letterhead, patient, dentist, valid until, items by stage, totals, notes, disclaimer, two signature lines; no buttons, no status column, no history | — |
| P-07 | Accept, one declined | Receptionist: Record acceptance, untick the cleaning | Live accepted total; plan Accepted with who and when; cleaning struck as Declined and gone from the chart | PASS (browser) |
| P-08 | Changed meanwhile | Two tabs: one revises and adds an item, the other records acceptance | "The plan was changed after it was shown…" | PASS (e2e) |
| P-09 | Do the work | Mark the filling done, then the crown | Each tooth takes the item's "Tooth becomes" on the chart (36 → crown); after the last one the plan is Completed; history lists every step | PASS (plan completes: browser; chart change: e2e) |
| P-10 | Bill it | Billing → new invoice for the patient → From treatments | Lines carry the plan's discounts; invoice total = estimate total | PASS (browser) |
| P-11 | Revise | Revise an accepted plan | Back to draft, acceptance cleared, done items stay done | PASS (e2e) |
| P-12 | Decline / cancel | Patient declined (with reason); on another, Cancel plan | Final; reason shown; open items off the chart; done items stay | PASS (e2e) |
| P-13 | Copy | Copy a cancelled plan as new plan | New draft with the same items and discounts, opens at once | PASS (e2e) |
| P-14 | Roles | Assistant: open a plan; receptionist: try to edit items | Assistant reads only; receptionist can only record the answer and print | PASS (e2e) |
| P-15 | Expired | A presented plan past its valid-until day | Warning on the plan and the card; answer can still be recorded | — |
| P-16 | Languages | Plan page, card and Treatments tab in hy / ru / en | All labels translated; Russian plurals ("2 процедуры") | PASS (browser) |
| P-17 | Archived patient | Archive the patient | "New plan" hidden; the API refuses | PASS (e2e) |


## 24. F2 — day / week schedule

Log in as a receptionist. Have three dentists, two rooms, a few appointments today and a blocked hour for one dentist.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| S-01 | Day view | Appointments → Day | One column per dentist; appointments at the right height; lunch block hatched; closed hours grey; red line at the current time | PASS (browser) |
| S-02 | Rooms | Switch Dentists → Rooms | One column per room plus "No room" | PASS (browser) |
| S-03 | Week view | Week, pick a dentist or room | Mon–Sun for that one; Saturday's shorter hours and Sunday shaded; title "9 Nov – 15 Nov 2026" | PASS (browser) |
| S-04 | Remembered | Reload | Same view and columns | PASS (browser) |
| S-05 | Drag | Drag an appointment to another dentist and time | Dialog with old → new time and dentist; Move saves it; the dentists get a notification | PASS (move: browser; notification: smoke 07) |
| S-06 | Refused drag | Drag into another dentist's blocked hour | Dialog shows "The dentist is unavailable then"; nothing moves | PASS (browser) |
| S-07 | Outside hours | Drag past closing time | Warning with "Move anyway" | — |
| S-08 | Resize | Drag an appointment's bottom edge | Dialog shows the new end time | — |
| S-09 | Room move | In Rooms, drag to "No room" | The appointment leaves its room | PASS (e2e: room cleared) |
| S-10 | Not draggable | Completed / in-progress appointments; an assistant | Cannot be dragged; clicking opens the appointment | — |
| S-11 | Book from grid | Click free time in a dentist's column | Booking form with that dentist, date, time and 30 min | PASS (browser) |
| S-12 | Slot picker | In the form choose dentist, date, length; then a room; then a patient | Chips show only times where all are free, nothing in the past; clicking one sets the time | PASS (browser + e2e) |
| S-13 | Reschedule | Open an appointment → Reschedule | Its own time is offered; choosing "None" for the room removes it | PASS (e2e) |
| S-14 | Languages | hy / ru / en | Weekday names, titles, toggles and dialogs translated | PASS (browser) |
| S-15 | Phone | 375 px | Columns scroll inside the grid; page does not scroll sideways (dragging needs a mouse) | PASS (browser) |


## 25. F3 — appointment reminders

Needs a real Telegram bot (from @BotFather) and, for SMS, a Twilio trial account — or the "Log only" provider. For patients to answer, the API must be reachable at `PUBLIC_API_URL` over HTTPS (or run with `TELEGRAM_POLLING=1` locally).

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| R-01 | Settings | Admin: Settings → Reminders; receptionist: try the API | Admin sees and changes them; others get 403; tokens never shown back | PASS (e2e + browser) |
| R-02 | Connect bot | Paste a wrong token, then the right one | Wrong: "Telegram did not accept this bot token"; right: "Connected: @yourbot" | PASS (e2e; browser with a fake Telegram) |
| R-03 | Link a patient | Patient → Profile → Link Telegram; open the link on a phone, press Start | Bot greets the patient by name; the card shows Telegram; the link does not work a second time | PASS (e2e) — real phone: — |
| R-04 | Send by SMS | In the link dialog, Send by SMS | The patient gets the link by SMS | — |
| R-05 | Day-before reminder | Book a visit for tomorrow; set the time to now | Within a minute: Telegram message with two buttons (linked patients) or SMS; Appointment page → Reminders shows it | PASS (browser: 3 SMS via fake Twilio) — real Telegram: — |
| R-06 | Not twice | Wait another few minutes; restart the API | No second reminder | PASS (e2e) |
| R-07 | Not at night / not if booked late | Book for tomorrow after the send time | No reminder for that visit | PASS (e2e + browser) |
| R-08 | Hours before | Turn on "2 hours before"; book for 3 hours from now | A reminder about 2 hours before | PASS (e2e) |
| R-09 | Confirm | Press "I will come" | Appointment Confirmed; the buttons are replaced by "Thank you…" | PASS (e2e) — real Telegram: — |
| R-10 | Cancel | Press "I can't come" | Appointment cancelled (patient request, note Telegram); dentist, admins and reception notified | PASS (e2e) — real Telegram: — |
| R-11 | Blocked bot | The patient blocks the bot; next reminder | Sent by SMS instead; the patient is unlinked | PASS (e2e) |
| R-12 | Opt out | Untick "Send this patient reminders" | Logged as "Not sent — the patient opted out" | PASS (e2e) |
| R-13 | Own text | Settings → Reminders → Reminder text, save; next reminder | Uses the text with placeholders filled; empty = standard text | PASS (e2e) |
| R-14 | Test message | Settings → Send a test to a patient by SMS / Telegram | Arrives, or a clear reason (no linked chat) | PASS (e2e) |
| R-15 | Languages | hy / ru / en | All reminder screens translated; message text follows the clinic language | PASS (browser, audit) |


## 26. F4 — patient account

Receptionist; one patient with two issued invoices (e.g. 20 000 and 15 000 ֏).

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| A-01 | Account card | Patient → Billing | Owed on invoices, Credit, Balance due | PASS (browser) |
| A-02 | Pay several | Take payment 50 000 | Parts fill the oldest invoices first; "To credit 15 000" shown live; both invoices Paid; credit 15 000 | PASS (browser + e2e) |
| A-03 | Change the split | Take payment, edit an invoice's part | Rest moves to credit; more than an invoice's balance or more than the amount is refused | PASS (e2e) |
| A-04 | Advance payment | Patient with no open invoices → Advance payment | All on account | PASS (e2e) |
| A-05 | Apply credit | New invoice → "Apply credit (…)" | Paid from credit; credit goes down; toast | PASS (browser) |
| A-06 | Undo applied credit | On that invoice, void the payment as a mistake | Money back to credit; invoice open again | PASS (e2e) |
| A-07 | Refund credit | Admin: Money on account → Refund with a reason | Credit gone; receptionist has no Refund button | PASS (e2e) |
| A-08 | Statement | Billing → Statement | Every invoice, payment, void with a running balance ending at the account balance; today's payment listed after its invoice | PASS (browser + e2e) |
| A-09 | Two cashiers | Both take a payment for the same patient at once | Never overpaid; one may get "An invoice changed… try again" | PASS (e2e) |
| A-10 | Reports | Reports → Revenue for today | Collected includes money on account; caption "of which on account …"; dentist report adds up with it in "unassigned" | PASS (e2e) |
| A-11 | Notifications / dashboard | Admin after an advance payment | "Payment on account" notification and activity open the patient's billing | — |
| A-12 | Languages | hy / ru / en | All account texts translated | PASS (browser hy, audit) |


## 27. F5 — day report and debtors

Receptionist and admin; a day with cash, card and transfer payments, an advance payment and a refund.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| Z-01 | Tabs | Billing as receptionist; as dentist | Invoices · Day report · Debtors; a dentist sees invoices only, the API refuses the others | PASS (browser + e2e) |
| Z-02 | Totals | Day report for today | Received, refunded, net, payment count, part on account | PASS (browser + e2e) |
| Z-03 | Method and cashier | Same | Per method; per cashier, with refunds under who gave the money back | PASS (browser + e2e) |
| Z-04 | Mistakes | Void a payment as a mistake | It leaves the day's received money | PASS (e2e) |
| Z-05 | Other days | Pick yesterday; pick a future day | Yesterday's own figures; the day picker stops at today | PASS (e2e) |
| Z-06 | Close | Count the drawer short by 500; close | Difference −500 shown before and after closing, with who and when | PASS (browser) |
| Z-07 | After closing | Take a payment on the closed day | "Changed after it was closed" warning; figures at closing kept | PASS (e2e) |
| Z-08 | Reopen | Admin: Reopen; receptionist | Admin reopens and can close again; receptionist has no button | PASS (e2e) |
| Z-09 | Print | Print | Report with the date, no buttons | — |
| Z-10 | Debtors | Billing → Debtors | Who owes, net of credit, largest first; fully paid and credit-only patients absent; age groups add up | PASS (browser + e2e) |
| Z-11 | Filters | Overdue only; minimum amount; oldest first | Lists narrow / reorder accordingly | PASS (e2e) |
| Z-12 | Languages | hy / ru / en | All texts translated | PASS (browser hy, audit) |

## 28. F6 — patient documents and X-rays

Receptionist, assistant, dentist; one patient; an X-ray (PNG or JPEG), a PDF and a photo.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| D-01 | Tab | Patient → Documents & X-rays | Empty state with a hint; `?tab=documents` opens it directly | PASS (browser) |
| D-02 | Upload X-ray | Receptionist: Upload, X-ray, teeth 36, 37, note | Appears first in the grid with date, kind and teeth; toast | PASS (browser + e2e) |
| D-03 | Several files | Drop a PDF and a photo at once | Both uploaded with the same details; "2 files uploaded" | PASS (browser) |
| D-04 | Wrong file | A program renamed to `.jpg`; an empty file; a file over the limit | Refused: only JPEG, PNG, WebP, PDF, DICOM / choose a file / too large | PASS (browser + e2e) |
| D-05 | Real type | A PNG named `.jpg` | Stored and served as PNG | PASS (e2e) |
| D-06 | Viewer | Open the X-ray; ← / →; open the PDF | Image fits, click zooms; arrows page through; PDF shown in the page | PASS (browser) |
| D-07 | DICOM | Upload a `.dcm` | Accepted, shown as a file icon; viewer offers download only | PASS (e2e) |
| D-08 | Download | Download | The same bytes, under the original name | PASS (e2e) |
| D-09 | Edit | Receptionist on own upload; on another's; dentist on any | Own: Edit shown and saves; another's: refused; dentist: allowed | PASS (browser + e2e) |
| D-10 | Remove | Receptionist; dentist with a reason | Receptionist has no Remove; dentist removes, reason required; gone from the list, file kept on disk | PASS (browser + e2e) |
| D-11 | Filters | Kind chips; tooth 36 | Lists narrow; "nothing matches" when empty | PASS (browser + e2e) |
| D-12 | Tooth drawer | Chart → tooth 36 | "X-rays and files" shows the X-ray; Add opens the upload with 36 filled in; the viewer opens over the drawer | PASS (browser) |
| D-13 | Other clinic | Another clinic's token | 404 on list, details, file, edit, upload; no token → 401 | PASS (e2e) |
| D-14 | Phone | 375 px | Grid two across; viewer full screen | PASS (browser) |
| D-15 | Languages | hy / ru / en | All texts translated | PASS (browser, audit) |

## 29. F7 — audit log

Admin, dentist, receptionist; one patient.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| L-01 | Who sees what | Menu and patient tabs as admin, dentist, receptionist; open `/audit` directly | Admin: "Audit log" in the menu and a History tab; dentist: History tab only; receptionist: neither, `/audit` goes to the dashboard; the API refuses the same | PASS (browser + e2e) |
| L-02 | Patient change | Receptionist changes a phone and the city | Entry with name, role, time, IP; Phone and Address · City old → new | PASS (browser + e2e) |
| L-03 | Medical history, photo | Admin adds an allergy and a photo | `Medical history · Allergies` — → latex; Photo "changed", no picture stored | PASS (e2e) |
| L-04 | Chart | Dentist marks 36 decayed with an occlusal surface | Tooth 36 · Status Healthy → Decayed, Surfaces, Notes; translated | PASS (browser + e2e) |
| L-05 | Money | Invoice, payment, void as a mistake; a USD clinic | Invoice number, amount with currency, paid 0 → 5 000, status Issued → Partial, void with its reason; USD amounts not in cents | PASS (e2e) |
| L-06 | Settings | Clinic language, a staff role, a catalogue price, a reschedule | Each old → new | PASS (e2e) |
| L-07 | Secrets | Save a Telegram bot token | "changed", the token nowhere in the log | PASS (e2e) |
| L-08 | Sign-ins | Sign in; wrong password; unknown email | Sign-in and failed sign-in with the reason; nothing for an unknown email; no password stored | PASS (browser + e2e) |
| L-09 | Telegram answers | Patient confirms / cancels in Telegram | Logged as the patient, status old → new | PASS (e2e) |
| L-10 | Documents | Open a patient's X-ray | "Opened a document" with its title, on the patient's history | PASS (e2e) |
| L-11 | Not logged | Browse, refresh the session, a refused or invalid change, mark notifications read | No entries | PASS (e2e) |
| L-12 | Filters | Dates, who, area, patient; Clear | List narrows; the request carries the filter | PASS (browser + e2e) |
| L-13 | Paging | More than 50 entries | 50 shown, "Show older" adds the rest, then "That's everything" | PASS (browser + e2e) |
| L-14 | Cannot change | Try PATCH / DELETE on an entry; update through the model | 404; refused | PASS (e2e) |
| L-15 | Other clinic | Another clinic's admin | Sees only its own entries; the patient's history is 404 | PASS (e2e) |
| L-16 | Languages, phone | hy / ru / en; 375 px | All texts translated, day headers with lower-case months; no sideways scroll | PASS (browser, audit) |

## 30. F8 — family links

Receptionist and admin; an adult patient (parent) and a child under 18.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| G-01 | New child | Add patient, birth date under 18 | "Parents and guardians" asks for one and warns while empty; saving without one is allowed | PASS (browser) |
| G-02 | Guardians on create | Add the father (a patient) and the mother (a contact); "Use the guardian's phone"; save | Father is main; the phone is filled; after saving the child's page shows both | PASS (browser) |
| G-03 | Family card | Child's profile; father's profile | Child: under 18 (age), guardians with main contact and phones, "not a patient" for the contact; father: the child under Children | PASS (browser + e2e) |
| G-04 | Change | Edit the mother: legal guardian, main contact | Relationship and main contact move; one main only | PASS (browser + e2e) |
| G-05 | Remove | Remove the main guardian | The next one becomes main | PASS (e2e) |
| G-06 | Refused | Self; twice; loop; 5th guardian; contact without phone; another clinic's patient; rename a linked guardian | Each refused with a clear message | PASS (e2e) |
| G-07 | Siblings | Two children of the same parent | Each lists the other as a sibling | PASS (e2e) |
| G-08 | Reminders | Child with a linked parent (Telegram), child with a contact, an adult with a guardian | Parent's Telegram, the contact's phone, the adult's own phone; text names the child; the log says which guardian | PASS (e2e) |
| G-09 | Parent answers | Parent presses "I will come" | Appointment confirmed; audit shows the parent | PASS (e2e) |
| G-10 | Reminder card | Child's profile | "Under 18: reminders go to <guardian>" | PASS (browser + e2e) |
| G-11 | Family account | Father's billing | Family card: each member's balance and the total | PASS (browser + e2e) |
| G-12 | Family payment | Take 25 000 for the family over 15 000 (child) + 8 000 (father) | Oldest first, labelled by person; child owes 0 (paid by father), father 2 000 credit | PASS (browser + e2e) |
| G-13 | Not family | Ordinary payment pointing at a child's invoice | Refused | PASS (e2e) |
| G-14 | Audit | Child's History | Guardian added / changed old → new in the user's language | PASS (browser + e2e) |
| G-15 | Who may | Assistant | Sees the family; cannot change it | PASS (e2e) |
| G-16 | Languages, phone | hy / ru / en; 375 px | All texts translated; card fits | PASS (browser, audit) |

## 31. F9 — account security

An admin, a receptionist, a phone with an authenticator app (or the walk's in-page code generator).

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| S-01 | Forgot password | Login → "Forgot password?" → email | Same confirmation for known and unknown emails; an email (log without SMTP) in the clinic language with a link | PASS (browser + e2e) |
| S-02 | Reset | Open the link, new password twice | Password changed; old one refused; other devices signed out | PASS (browser + e2e) |
| S-03 | Link rules | Reuse the link; a link over an hour old; an older link after a newer one | "Expired or already used" | PASS (e2e) |
| S-04 | Admin must set up | Admin signs in without two-factor | Setup step: QR, key, first code → backup codes once → in | PASS (browser + e2e) |
| S-05 | Code step | Sign in again | Code asked; wrong code refused (counts toward lockout); right code in | PASS (browser + e2e) |
| S-06 | Codes once | Reuse the same app code; reuse a backup code | Refused | PASS (e2e) |
| S-07 | Trusted device | Tick "Don't ask for 30 days"; sign in again; then "Log out everywhere" | No code next time; asked again after logging out everywhere | PASS (browser + e2e) |
| S-08 | Optional for staff | Receptionist: Account security → Set up; Turn off | On with backup codes; off with a code | PASS (browser + e2e) |
| S-09 | Required can't be off | Admin: Turn off | Not offered; refused by the API | PASS (e2e) |
| S-10 | New backup codes | New backup codes with a code | 10 new; old ones stop working | PASS (e2e) |
| S-11 | Devices | Two sign-ins; sign out the other | Both listed with "This device"; the other is signed out; someone else's device can't be | PASS (browser + e2e) |
| S-12 | Staff security | Admin on a staff member: sign out everywhere; reset two-factor | They are signed out; after reset they sign in without a code (or set up again if required); receptionist can't | PASS (browser + e2e) |
| S-13 | Audit | Audit log | Each step logged; no secret or code in it | PASS (e2e) |
| S-14 | Languages, phone | hy / ru / en; 375 px | All texts translated | PASS (browser, audit) |

## 32. F10 — fiscal receipt numbers (manual)

Receptionist; two issued invoices; the clinic's own cash register (any number will do in a test).

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| R-01 | With the payment | Add a payment with "Fiscal receipt number" | Saved; shown in the invoice's payments | PASS (browser + e2e) |
| R-02 | Later | A payment without one → "Add number" on the invoice | Saved; the payment leaves the missing list | PASS (browser + e2e) |
| R-03 | Duplicate | Use a number already on another payment | "Already recorded on another payment" | PASS (browser + e2e) |
| R-04 | One receipt | One payment over two invoices plus credit | One row in the list for the whole amount; one number covers every part | PASS (e2e) |
| R-05 | Change / clear | Change a number; Remove number | Updated; back in the missing list | PASS (e2e) |
| R-06 | Bad input | "№12"; 41 characters | Refused | PASS (e2e) |
| R-07 | Voids | A payment voided as a mistake; one refunded | Mistake leaves the list; refund stays, marked | PASS (e2e) |
| R-08 | Fiscal receipts tab | Billing → Fiscal receipts | Without / with a number / all with counts, dates, add in place | PASS (browser + e2e) |
| R-09 | Day report | Day report with a payment without a number | Warning with the count; "Fill in" opens the list for that day; numbers in the payments table | PASS (browser + e2e) |
| R-10 | Who may | Dentist, assistant, another clinic | Refused / sees nothing | PASS (e2e) |
| R-11 | Audit | After setting a number | "Recorded a fiscal receipt number", old → new | PASS (e2e) |
| R-12 | Languages, phone | hy / ru / en; 375 px | All texts translated; no sideways scroll | PASS (browser, audit) |

## 33. F11 — report export and dentist commission

Admin, two dentists with work paid last month, receptionist.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| E-01 | Excel | Reports → Export → Excel | .xlsx with a sheet per section; header row frozen; numbers and dates are real numbers and dates | PASS (browser + e2e) |
| E-02 | CSV | Export → CSV | One file, sections one after another; Armenian shows correctly in Excel (BOM); commas and quotes quoted | PASS (browser + e2e) |
| E-03 | Formula-looking text | A value starting with = | Stays text (CSV prefixed with '); never a formula | PASS (e2e) |
| E-04 | Dentist export | Export as a dentist | Only their own sections, no money | — |
| E-05 | Rates | Commission → Rates: default 30 %, one dentist 40 % | Rows recalculated: collected × rate | PASS (browser + e2e) |
| E-06 | Live month | Last month | Each dentist's collected, rate, commission; the work behind it; unassigned money shown apart | PASS (browser + e2e) |
| E-07 | Approve | Approve last month; this month | Frozen with who and when; this month can't be approved yet | PASS (browser + e2e) |
| E-08 | Frozen | Change a rate after approval | Approved month keeps its rate | PASS (e2e) |
| E-09 | Refund after approval | Refund a payment of an approved month | The month shows the change; the next month shows it as an adjustment; approving it settles it once | PASS (e2e) |
| E-10 | Reopen | Reopen an earlier month while a later one is approved; reopen the latest | Refused / reopened, settled amounts go back | PASS (e2e) |
| E-11 | Dentist view | As a dentist | Own row and lines only; no rates, approve or reopen | PASS (browser + e2e) |
| E-12 | Audit, tenancy | Audit log; another clinic | Rate changes, approvals, reopenings logged; another clinic sees nothing | PASS (e2e) |
| E-13 | Languages, phone | hy / ru / en; 375 px | All texts translated, month names too; tables scroll in their own box | PASS (browser, audit) |

## 34. F12 — periodontal chart and mixed dentition

Admin, dentist, assistant, receptionist; an 8-year-old and an adult patient.

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| PM-01 | Suggested type | Open the chart of a child aged 3, 8, 14 for the first time | Primary / mixed / permanent | PASS (browser: 8) |
| PM-02 | New mixed chart | Mixed | 20 primary teeth and 16, 26, 36, 46; empty dashed places for the rest | PASS (browser + e2e) |
| PM-03 | Switch keeps what was charted | Permanent chart with a note on 11 → mixed → permanent → mixed | 11 stays permanent with its note; other places primary; nothing lost either way | PASS (e2e) |
| PM-04 | Eruption | Primary 51 → "Permanent 11 erupted" | 11 replaces 51 and opens; 51 with its history is kept | PASS (browser + e2e) |
| PM-05 | Molar | Empty place 17 → "Erupted" | 17 added | PASS (e2e) |
| PM-06 | Undo | On 11: "Undo: bring back primary 51"; then erupt 11 again | 51 back with its history; the same 11 comes back | PASS (browser + e2e) |
| PM-07 | Refusals | Erupt on a permanent chart; erupt 16 twice; an assistant erupts | Refused with a clear message / not offered | PASS (e2e) |
| PM-08 | New exam | Periodontal chart → New exam (chart has 18 missing, 36 implant) | All chart teeth; 18 struck through, 36 "Imp" | PASS (browser + e2e) |
| PM-09 | Keyboard entry | Type 3 2 3 4 5 4 1 0 7 … | Fills site after site; "1 0" = 10; arrows, Backspace, Space work | PASS (browser) |
| PM-10 | Colours and CAL | Depths 4, 6; recession 2 | 4 amber, 6 red; attachment loss = depth + recession | PASS (browser) |
| PM-11 | Autosave | Type, then reload the page | "All changes saved"; values still there after the reload | PASS (browser) |
| PM-12 | Figures | After entry | Mean depth, mean attachment loss, % bleeding / plaque, sites ≥ 4 / ≥ 6 mm, mobile teeth, furcation | PASS (browser + unit) |
| PM-13 | Compare | Second exam | Previous depths under each site; 2 mm better green, worse red; figures side by side with arrows | PASS (browser + e2e) |
| PM-14 | Print | Print | Landscape; patient, date and dentist heading; no menus or tabs | — |
| PM-15 | Details, removal | ⋮ → date / dentist / notes; Remove with a reason | Saved; removed exam gone, previous one opens | PASS (browser + e2e) |
| PM-16 | Roles | Receptionist; assistant | Receptionist reads only; assistant records but cannot remove | PASS (e2e) |
| PM-17 | Audit, tenancy | Patient history; another clinic | "Recorded periodontal findings on a tooth · Tooth 16 · Depth: … → …"; eruptions logged; another clinic sees nothing | PASS (browser + e2e) |
| PM-18 | Languages, phone | hy / ru / en; 375 px | All texts translated; the grid scrolls in its own box with the row names fixed | PASS (browser, audit) |

---

## Known gaps (not bugs — not yet built)

| Area | Note |
|---|---|
| Platform admin | `Role.SUPER_ADMIN` is declared but unused — no way to list clinics or support a customer |
| Audit log | Every change through the app is logged since F7, with old → new values for key records. Changes before F7, or made directly in the database, are not |
| Photos | Profile photos are still base64 on the patient document (192px, ~8KB). The F6 file store could take them if they get bigger |
| Legacy phones | Formats that don't parse are logged, not fixed — need manual cleanup |
| JWT secrets | `backend/.env` has dev placeholders. Production startup refuses missing, short (<32) or identical secrets when `MODE=PROD` |
| Mobile layout | Below 900px the sidebar is an overlay drawer opened from the header (M-01–M-04). Pages themselves aren't redesigned for phones: wide tables scroll sideways inside their own box |
| Type safety | `strict` is on, but 177 explicit `any` remain in the frontend (mostly saga `action: any`) and 18 in the backend |
| Backend lint | The backend has no ESLint config; `npm run lint` there fails to start |
