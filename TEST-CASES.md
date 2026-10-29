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

---

## Known gaps (not bugs — not yet built)

| Area | Note |
|---|---|
| Platform admin | `Role.SUPER_ADMIN` is declared but unused — no way to list clinics or support a customer |
| Patient audit | Only **status** changes are audited. Edits to name, phone, medical history are not |
| Photos | Stored as base64 on the patient document (192px, ~8KB). Fine at this scale; would need a file store if photos get bigger |
| Legacy phones | Formats that don't parse are logged, not fixed — need manual cleanup |
| JWT secrets | `backend/.env` has dev placeholders. Production startup refuses missing, short (<32) or identical secrets when `MODE=PROD` |
