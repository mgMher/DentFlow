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

> ⚠️ **Do not run the seed script** to create test data. `backend/src/seed.ts` starts with
> `deleteMany({})` on clinics, users and patients — it will wipe the existing database.

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
| DEN-03 | Save status | Change status to Filled, save | Tooth changes colour on the chart | — |
| DEN-04 | **Status history** | Reopen the same tooth | "Status History" shows `Healthy → Filled`, timestamp | — |
| DEN-05 | **History accumulates** | Change to Crown, then Root canal | Three entries, newest first — **old status is not lost** (this was the main bug) | — |
| DEN-06 | Notes in history | Change status with a note | Note appears under the entry | — |
| DEN-07 | Surfaces | Open the surfaces list | **8 options**: Mesial, Distal, Occlusal, Incisal, Buccal, Lingual, Palatal, Cervical — all translated | — |
| DEN-08 | Legend | Below the chart | All 10 statuses with colours, translated | — |
| DEN-09 | Drawer on narrow window | Shrink the window | Drawer is full width, no page overflow | — |

### Record treatment (new form)

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| DEN-20 | Form present | Tooth drawer → "Record Treatment" | Collapsible section opens | — |
| DEN-21 | Catalogue autofill | Pick a treatment from the dropdown | Name **and price + currency** auto-fill from the catalogue | — |
| DEN-22 | Custom treatment | Pick "Other (type manually)", type a name | Accepted | — |
| DEN-23 | Name required | Submit with an empty name | Inline required error | — |
| DEN-24 | Dentist default | Open the form as a dentist | Your own name preselected | — |
| DEN-25 | Dentist choice | Pick another dentist | Accepted | — |
| DEN-26 | Date | Defaults to today; try a future date | Today by default; future dates blocked | — |
| DEN-27 | Surfaces prefilled | Tooth already has surfaces | Same surfaces ticked in the treatment form | — |
| DEN-28 | Save | Fill and submit | Success toast; form collapses and clears | — |
| DEN-29 | **Appears in history** | Look at "Treatment History" below | New entry with name, date, **dentist name and cost** | — |
| DEN-30 | Currency | Clinic currency vs catalogue currency | Cost shows with the right symbol (֏ / $ / ₽) | — |
| DEN-31 | Empty state | Tooth with no treatments | "No treatments recorded for this tooth" | — |

### Pediatric charts

| ID | What to test | Steps | Expected | Status |
|---|---|---|---|---|
| DEN-40 | Child default | Create a patient **under 13**, open the chart tab | Chart created as **pediatric** — 20 teeth (51–70), two arches of 10 | — |
| DEN-41 | Adult default | Patient 13 or older | 32 teeth (1–32) | — |
| DEN-42 | Toggle present | Above the chart | Adult / Child toggle showing the current type | — |
| DEN-43 | Switch warns | Click the other type | Confirm dialog explains statuses and history reset, treatments are kept | — |
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

## Known gaps (not bugs — not yet built)

| Area | Note |
|---|---|
| Platform admin | `Role.SUPER_ADMIN` is declared but unused — no way to list clinics or support a customer |
| Patient audit | Only **status** changes are audited. Edits to name, phone, medical history are not |
| Photos | Stored as base64 on the patient document (192px, ~8KB). Fine at this scale; would need a file store if photos get bigger |
| Legacy phones | Formats that don't parse are logged, not fixed — need manual cleanup |
| JWT secrets | `backend/.env` has dev placeholders. Must be changed before production (`config/jwt.config.ts` already throws if they're missing when `NODE_ENV=production`) |
