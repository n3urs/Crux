# BoulderRyn — Development Log

> Updated as we go. Read this at the start of every session to pick up where we left off.

---

## Project Overview

Full climbing gym management platform. Cloning/improving on BETA software at `gym.sendmoregetbeta.com` (v26.23).

- **Repo:** https://github.com/n3urs/boulderryn (public)
- **Stack:** Express.js + Node.js + SQLite (better-sqlite3) + Tailwind CSS CDN
- **DB:** `data/boulderryn.db`
- **Server:** `PORT=8080 node server.js` — kill old with `pkill -f "node server.js"`
- **Tunnel:** `/usr/local/bin/cloudflared tunnel --url http://localhost:8080` (temp URL)
- **Auth:** No persistent login. PIN-based per-action auth. Staff PIN: Oscar's is `2109`.
- **Colour scheme:** Blue/navy (`#1E3A5F` primary)

---

## Architecture

```
src/
  routes/          — Express API routes (members, passes, checkin, pos, settings, etc.)
  main/
    models/        — DB model classes (member, pass, staff, product, route, etc.)
  public/
    index.html     — Staff management app shell
    app.js         — All frontend JS (~5500+ lines, SPA router)
    app.html       — Member-facing portal (login, booking, wall map)
    register.html  — Public registration page (waiver + induction video)
```

Frontend is a vanilla JS SPA. `loadPage(name)` switches views. All API calls via `api(method, path, body)` helper.

---

## Pages / Features Built

### Dashboard (Visitors page — default landing)
- Stats: in gym now, revenue today, members count, this week revenue
- Quick search (min 3 chars)
- "Needs Validation" list — members with no waiver or unpaid reg fee, "Collect £3" button
- Active Visitors list — shows checked-in members today, QR scan check-in
- `+` FAB — quick add / walk-in

### Members Page
- Member list with search, filters (active pass, tag, etc.)
- Member card → opens **Profile Modal**

### Profile Modal (4 tabs: Overview | Passes | Transactions | Events)
**Overview tab:**
- Full-width photo (or initials block), camera icon to upload in-place
- `POST /api/members/:id/photo` via multer → `data/photos/`
- Icon rows: DOB+age, gender, email, phone, address, emergency contact
- Under-18 badge (blue), Warning flag (orange button → red badge when set)
  - `POST /api/members/:id/warning` — sets `has_warning` + `warning_note`
- Collapsible sections: Comments, Forms, Tags
- Forms: shows waiver date/expiry, "Collect £3" or "✓ Validated"
- Tags: coloured pills
- Buttons: "Assign Pass", "Open in POS", "Edit Profile"

**Passes tab:**
- Beta-style pass cards (square badge, date range, gear menu, "Paused" tag)
- Gear menu: Pause / Resume / Cancel
- Check In button (10-visit passes show remaining count)

**Transactions tab:**
- Vouchers section (collapsible, gift card code + balance)
- History table: date+time | items | amount + status badge
- Pagination: client-side, `GET /api/members/:id/transactions?page=&perPage=`
- Status badges: Succeeded (green), open (dark), Failed (red), Refunded (orange)

**Events tab:**
- Sub-filter pills: All / Upcoming / Attended / Missed / Cancelled

### Edit Modal (tabbed: Edit | Merge Profile | Family Members)
- Edit: Beta-layout with middle name, DOB dropdowns, address block, duplicate detection
- Merge Profile: search (min 3 chars), Swap button, profile preview
- Family Members: link/unlink family

### POS (Point of Sale)
- Full cart with line items
- Each day entry item has a **member chip** (blue pill) — tap to reassign to any member
- Multi-person day pass: open from Dad's profile → add items → swap chips for kids → pay → all checked in
- Dojo card reader integration (placeholder/skeleton)
- GoCardless recurring DD (placeholder)

### Check-in Flow
- QR code check-in (desk scan)
- Single-entry passes expire at end of same day (23:59:59)
- 10-visit passes: decrements `visits_remaining`, expires at 0
- Both desk and QR routes updated
- `visits_remaining` shown on Check In button: "Check In (3 left)"

### Assign Pass (on member profile)
- "Assign Pass" button between "Open in POS" and "Edit Profile"
- Requires manager PIN (`members_edit` permission)
- Modal: pick pass type (grouped by category), peak/off-peak toggle, optional custom price
- Useful for comps, staff passes, free entries

### Settings Page (5 tabs)

#### Staff tab
- Table: Name, Role, Email, Status, Actions (Edit / Reset PIN / Deactivate)
- Role badge (pink pill for Owner)
- `+ Add Staff` button

#### Products tab
- 92 products across 9 categories
- Grouped by category with `+ Add here` and `Edit` (category)
- Per-product: price, active dot, edit/archive icons
- `+ Category` and `+ Product` buttons

#### Pass Types tab
- Grouped by category (labels from `PASS_CATEGORIES` map)
- Categories: `single_entry`, `multi_visit`, `monthly_pass`, `membership_dd`, `annual_membership`, `staff`
- Per-pass: peak/off-peak price, duration, visits, active dot, edit/disable icons
- `+ New Pass Type` button

#### General tab
- Gym Details: name, contact email, phone, website, address
- Opening Hours: Mon–Sun free text fields
- Pricing: reg fee, shoe rental, peak/off-peak labels
- Induction Video: YouTube URL
- Save Changes button (PUTs each key individually to `/api/settings/:key`)

#### Integrations tab
- GoCardless: access token + sandbox/live toggle
- Dojo: API key + terminal ID
- Email/SMTP: host, port, from address, username, password

---

## Database

### Key tables
| Table | Purpose |
|---|---|
| `members` | All members — includes `has_warning`, `warning_note`, `photo_url` (added via ALTER) |
| `staff` | Staff — `pin_hash` (salted PBKDF2), `role`, `permissions_json`, `is_active` |
| `pass_types` | Pass type definitions |
| `member_passes` | Issued passes — `visits_remaining`, `status` |
| `check_ins` | Check-in log |
| `transactions` / `transaction_items` | POS transactions |
| `products` / `product_categories` | POS products |
| `settings` | Key/value store for gym config |
| `gift_cards` / `gift_card_transactions` | Vouchers |
| `events`, `event_enrolments`, etc. | Events system (partial) |
| `walls`, `climbs`, `climb_logs` | Routes system (partial) |

### Test data
- 3 test members: Oscar Sullivan, Arlo Barnes (12), Bex Bourne
- 92 products, 9 categories
- Pass types seeded

---

## API Routes

```
GET/PUT  /api/settings / /api/settings/:key
GET      /api/members
GET/PUT  /api/members/:id
POST     /api/members/:id/photo
POST     /api/members/:id/warning
GET      /api/members/:id/transactions
GET      /api/members/:id/vouchers
GET/POST /api/passes/types
GET/PUT  /api/passes/types/:id
POST     /api/passes/issue
POST     /api/checkin
POST     /api/staff/auth/pin
GET/POST /api/staff
PUT/DEL  /api/staff/:id
GET/POST /api/products
GET/PUT/DEL /api/products/:id
GET/POST /api/products/categories
PUT/DEL  /api/products/categories/:id
POST     /api/pos/transaction
```

---

## Security

- PINs: salted PBKDF2 (sha512, 10000 iterations)
- JWT secret: env-based (`JWT_SECRET` in `.env`)
- Legacy plain SHA256 PINs auto-upgraded on first use
- GDPR: data export + deletion endpoints

---

## Known Issues / TODO

- [ ] Staff login/roles — full role-based access control not wired to all endpoints yet
- [ ] GoCardless integration — skeleton only, needs real DD flow
- [ ] Dojo integration — skeleton only, needs real payment initiation

## Completed Features (2026-03-08 session)

- [x] Staff Management — `saveStaff`, `resetStaffPin`, `toggleStaffStatus`, `deleteStaff` all wired, tested
- [x] Analytics page — KPI cards, Revenue/Check-in bar charts, EOD report, Popular Products, Grade Distribution
- [x] Events page — List view, Calendar view, Create event modal, event detail, enrol/cancel
- [x] Routes page — Cards view, Map view, Add Climb modal, Grade Distribution chart, Reset Gym
- [x] Email QR Code — "Email QR Code" button added to member profile Overview tab action buttons
- [x] Send Receipt — "Send Receipt" button added to POS success screen (shows for members with email)
- [x] POS `posSendReceipt()` function added to pos.js (calls POST /api/email/send-receipt)

---

## Git Log (recent)

```
f997262 Settings: Staff Management + General tabs fully built
68da617 GDPR compliance + Dojo payment integration skeleton
7f4a8f0 Security: salted PIN hashing, env-based JWT secret
5e00276 Fix: memberColour -> nameToColour (crash fix)
e3bdba1 Fix bugs found in testing
1062e64 Merge Profile: match Beta exactly
986c1cc Pass cards: Beta-style layout
b5c12ef Edit form: match Beta layout
4e072bf Multi-person day pass: assign each cart item to different members
68be367 Fix day passes to expire at midnight + Assign Pass button
98ed7ab 10-visit passes expire when all visits used
2b45061 Profile modal overhaul: photo, warning flag, icon info rows
a62b65a Transactions tab: Beta-style layout, pagination, status badges
```

---

## Session Notes

### 2026-03-08
- Tested all 5 Settings tabs visually — all looking good
- Fixed `PASS_CATEGORIES` map missing `membership_dd` key (was showing raw DB key in UI)
- Created this DEVELOPMENT.md

### 2026-03-08 (subagent pass)
- Verified all 6 task areas: Staff, Email, Analytics, Events, Routes — all working
- Added "Email QR Code" button directly on member profile Overview tab (not just in QR modal)
- Added "Send Receipt" button in POS success screen for members with email
- Added `posSendReceipt(transactionId, memberId)` async function in pos.js
- Full test pass via browser: Dashboard, Events, Routes, Analytics, Settings/Staff all confirmed working
- No JS console errors on any page
