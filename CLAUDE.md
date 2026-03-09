# CLAUDE.md — Crux Platform Context

Read this first. This is the full context for continuing work on the Crux gym management SaaS.

---

## What Is Crux?

Crux is a **multi-tenant SaaS platform** for climbing and bouldering gyms. Gyms pay a monthly subscription to access the platform. Each gym gets their own isolated subdomain (`gymname.cruxgym.co.uk`) and a completely separate SQLite database. There is no shared data between gyms.

**Business model:** Oscar (the platform owner) sells subscriptions to gym owners. Starter £59/mo, Growth £99/mo, Scale £149/mo. 14-day free trial on signup.

**Target market:** UK climbing and bouldering gyms, specifically independent operators who can't afford or don't need bloated enterprise software.

---

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite via `better-sqlite3` (one DB per gym + one platform DB)
- **Frontend:** Vanilla HTML/CSS/JS SPA (no framework), Tailwind CSS via CDN
- **Auth:** JWT for staff sessions, PIN-based login for staff at the desk
- **Email:** Nodemailer via Gmail SMTP (`cruxgymhq@gmail.com`)
- **Payments (member-facing):** GoCardless (direct debit) + Dojo (in-person card) — placeholders/partial
- **Payments (platform billing):** Stripe — live with real API keys, checkout + webhook handler active
- **Hosting:** AWS EC2 (eu-west-1), served via nginx

---

## Repository Structure

```
boulderryn-project/          ← repo root (yes, old name, rename is pending)
├── server.js                ← main Express server entry point
├── scripts/
│   └── provision-gym.js     ← CLI + exportable function to create a new gym
├── src/
│   ├── main/
│   │   ├── database/
│   │   │   ├── db.js           ← per-gym DB connection (AsyncLocalStorage context)
│   │   │   ├── gymContext.js   ← gym context middleware
│   │   │   ├── init.js         ← DB initialisation + legacy migration
│   │   │   └── platformDb.js   ← global platform DB (billing records)
│   │   ├── models/
│   │   │   ├── member.js, waiver.js, staff.js, etc.
│   │   └── services/
│   │       ├── email.js         ← member emails (QR codes, receipts)
│   │       └── welcomeEmail.js  ← new gym onboarding email
│   ├── middleware/
│   │   ├── requireAdmin.js      ← ADMIN_TOKEN check for /admin routes
│   │   └── requireBilling.js    ← subscription check (wired into all /api routes)
│   ├── routes/
│   │   ├── admin.js             ← super-admin panel API
│   │   ├── billing.js           ← Stripe billing routes
│   │   ├── signup.js            ← self-serve gym signup + Stripe checkout creation
│   │   ├── export.js            ← GDPR data export (JSON + CSV)
│   │   ├── members.js, staff.js, pos.js, waivers.js, etc.
│   │   └── onboarding.js        ← onboarding status + dismiss
│   ├── config/
│   │   └── stripe.js            ← Stripe client (uses STRIPE_SECRET_KEY env var)
│   ├── shared/
│   │   └── schema.sql           ← SQLite schema for per-gym DBs
│   └── public/
│       ├── index.html           ← login/setup page
│       ├── app.html             ← main SPA shell
│       ├── app.js               ← entire SPA frontend (large file)
│       ├── signup.html          ← self-serve gym owner signup page
│       ├── register.html        ← public member registration + waiver page
│       └── admin.html           ← super-admin panel UI
├── data/
│   ├── platform.db              ← global billing DB
│   └── gyms/
│       └── {gym_id}/
│           ├── gym.db           ← per-gym database
│           └── photos/          ← member photos
├── crux-app.service             ← systemd service file (copy to /etc/systemd/system/)
├── DEVELOPMENT.md               ← dev setup, architecture notes
├── PRODUCT.md                   ← product spec, feature list
├── BILLING.md                   ← Stripe billing implementation notes
├── ONBOARDING.md                ← onboarding wizard implementation notes
├── WAIVER_EDITOR.md             ← waiver editor implementation notes
└── SUPER_ADMIN.md               ← super-admin panel implementation notes
```

---

## How to Run

```bash
cd /home/ec2-user/.openclaw/workspace/boulderryn-project

# Development (single gym, no subdomain routing)
DEFAULT_GYM_ID=mygym PORT=8080 node server.js

# With admin panel enabled and a specific token
DEFAULT_GYM_ID=mygym PORT=8080 ADMIN_TOKEN=mysecrettoken node server.js

# Provision a new gym
node scripts/provision-gym.js mygym "My Gym Name"
```

**Admin panel:** Visit `/admin` → login with `ADMIN_TOKEN` value.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEFAULT_GYM_ID` | Gym to use in dev (bypasses subdomain routing) | required in dev |
| `PORT` | Server port | 8080 |
| `JWT_SECRET` | JWT signing secret | insecure fallback (fix in prod) |
| `ADMIN_TOKEN` | Admin panel access token | `admin_secret_placeholder` |
| `CRUX_DATA_DIR` | Custom data directory | `./data` |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_test_placeholder` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | empty |
| `STRIPE_PRICE_STARTER` | Stripe price ID for Starter plan | empty |
| `STRIPE_PRICE_GROWTH` | Stripe price ID for Growth plan | empty |
| `STRIPE_PRICE_SCALE` | Stripe price ID for Scale plan | empty |
| `SMTP_USER` | Gmail SMTP user | `cruxgymhq@gmail.com` |
| `SMTP_PASS` | Gmail app password | hardcoded in welcomeEmail.js |

---

## What's Been Built (Complete)

### Core gym app features
- ✅ Member management (profiles, photos, tags, notes, warning flags)
- ✅ Check-in system (desk check-in, QR code scan)
- ✅ Pass types & memberships (configurable)
- ✅ Point of Sale (cart, products, categories, receipts)
- ✅ Digital waiver & induction (adult + minor, video + signature)
- ✅ Staff management (roles: Owner, Tech Lead, Duty Manager, Centre Assistant, Route Setter — PIN + password login)
- ✅ Analytics & reporting (KPI dashboard, EOD reports, charts)
- ✅ Events management
- ✅ Route tracking & wall map
- ✅ Email automation (welcome, QR codes, receipts) via nodemailer

### Platform / SaaS features
- ✅ Multi-tenancy — per-gym isolated SQLite DBs
- ✅ Subdomain routing (`gymname.cruxgym.co.uk → gym_id`) — Cloudflare wildcard DNS + nginx configured
- ✅ Waiver editor — gym owners build their own waiver sections, video URL (Settings → Waivers)
- ✅ Setup wizard — 5-step forced setup on first login (gym details, induction video, waiver builder, gym map, pass types)
- ✅ Gym map builder — draw walls as polylines on a top-down floor plan, rooms as named groups; Settings → Gym Map for post-setup edits
- ✅ Blank-slate provisioning — no default products/passes/waiver content; everything configured by the gym owner
- ✅ Stripe billing — live keys, plans, checkout, portal, webhook handler, Billing tab in Settings
- ✅ Billing gate UI — 402 responses show a full-screen subscription wall with reactivate button
- ✅ `requireBilling` middleware — wired into all `/api` routes (exempts `/staff/auth`, `/climber/auth`, `/gym-info`)
- ✅ Super-admin panel — `/admin` with gym list, provision form, suspend/activate
- ✅ Welcome email — sent to new gym owners on provisioning
- ✅ Self-serve signup — `/signup` page with gym name, subdomain picker, plan selection → Stripe checkout → auto-provision
- ✅ Logo upload — Settings → General, stored as base64, shown in sidebar
- ✅ GDPR data export — Settings → General, `/api/export/gdpr` (JSON) + `/api/export/members.csv`
- ✅ systemd service — running on EC2 as `crux-app.service`

---

## Self-Serve Signup & Auth — How It Works

This feature is now built. Here's how the flow works:

### Domain structure
- `cruxgym.co.uk` — marketing site + "Sign Up" / "Log In" links
- `cruxgym.co.uk/signup` — signup page (backend route + HTML)
- `cruxgym.co.uk/login` — login page for returning users
- `gymname.cruxgym.co.uk` — individual gym instance

### Signup flow (`/signup`)
Multi-step:
1. **Personal details** — name, email, password (gym owner account)
2. **Gym details** — gym name, subdomain (auto-generated from gym name)
3. **Stripe** — card details, 14-day trial (redirects to Stripe Checkout)
4. On completion: gym provisioned, owner account created, welcome email sent, redirect to subdomain with welcome modal

### Login flow (`/login`)
- Email + password
- Redirect to gymname.cruxgym.co.uk on success

### Staff accounts
- All staff get email accounts
- Invite flow: owner enters email in Settings → Staff → invite email sent → staff sets password via link
- **Desk login:** PIN only (quick actions, each staff has unique PIN for audit)
- **Web/remote login:** email + password

### Role-based permissions
**Full access** (Owner, Tech Lead, Duty Manager): everything
**Desk-only** (Centre Assistant, Route Setter): Visitors, Members, POS, Events (view only), Routes (Route Setter only)
**Restricted:** Analytics, Settings, Billing, Staff management (admin/manager only)

Sidebar only shows permitted nav items based on role.

---

## What Still Needs Doing

### Dev/testing utilities

**Reset setup wizard on existing gym:**
```bash
sqlite3 data/gyms/{gym_id}/gym.db "UPDATE settings SET value='0' WHERE key='setup_complete';"
```

**Full reset for local dev:**
```bash
sqlite3 data/gyms/mygym/gym.db "DELETE FROM staff; UPDATE settings SET value='0' WHERE key='setup_complete';"
DEFAULT_GYM_ID=mygym PORT=8080 node server.js
```

---

## Full Roadmap — Everything Left To Build

Roughly in priority order. Claude Code should work through these in sequence.

---

### PRIORITY 1 — Member Portal
Fully specced above in the "Member Portal" section. This is the biggest missing piece.

---

### PRIORITY 2 — Integration & Navigation

Already documented in the "Integration" section above. Key items:
- Marketing site Sign Up / Log In buttons linked to `/signup` and `/login`
- Login routes user to correct gym subdomain by email lookup
- Member registration link + QR code widget inside staff app (shareable / printable)
- Member portal link in welcome email and registration confirmation email
- Settle and document super-admin URL

---

### PRIORITY 3 — Super-Admin Panel Improvements

Oscar (platform owner) needs a proper control panel, not just a gym list.

**Impersonate / Open Gym:**
- Each gym in the admin list should have an "Open Gym" button
- Clicking it generates a one-time login token for that gym, redirects Oscar to `gymname.cruxgym.co.uk` already logged in as Owner
- Backend: `POST /admin/impersonate/:gymId` → returns a short-lived token → redirect to `gymname.cruxgym.co.uk/?adminToken=xxx`
- Gym app checks for `?adminToken=` on load, exchanges for a full session

**Revenue dashboard on admin panel:**
- Total active gyms, trialing gyms, churned gyms
- MRR (monthly recurring revenue) — calculated from active subscriptions
- Trial gyms ending in the next 7 days (conversion risk)
- Recent signups list

**Quick links on admin panel:**
- Link to Stripe dashboard
- Link to cruxgym.co.uk marketing site
- Link to server logs / status
- Link to each gym's subdomain

---

### PRIORITY 4 — Email Improvements

**Branded email templates:**
- All emails (welcome, QR code, invite, receipt) should use a consistent HTML template
- Crux logo at top, clean layout, navy/white colour scheme
- Footer: "Powered by Crux · cruxgym.co.uk · Unsubscribe"

**Onboarding email sequence (automated, time-based):**
- Day 0: Welcome email (already exists)
- Day 3: "Getting started" tips — how to add members, set up pass types
- Day 7: "You're one week in" — checklist of setup steps with links
- Day 13: "Your trial ends tomorrow" — reminder to add card details + Stripe portal link
- Day 14 (if no card): "Trial expired" — subscription wall + link to reactivate

**Member emails:**
- Registration confirmation: "Welcome to {Gym Name}" — includes member portal link (`/me`), QR code image, pass details
- Pass expiry reminder: 7 days before + 1 day before
- Receipt email: after POS transaction (if email provided)

---

### PRIORITY 5 — Production Hardening

**Security:**
- Set `JWT_SECRET` to a real random string in `/etc/crux.env` (currently using insecure fallback)
- Set `ADMIN_TOKEN` to a real secret (not `admin_secret_placeholder`)
- Rate limiting on auth endpoints (`/me/auth/request`, `/signup`, `/login`) — prevent OTP abuse
- HTTPS for `*.cruxgym.co.uk` subdomains — Cloudflare handles this (already proxied), but confirm SSL mode is Full not Flexible
- Input validation on all public-facing routes (signup, register, member portal)

**Rename the repo and folder:**
- `boulderryn-project/` → should be renamed to `crux/` or `cruxgym/`
- GitHub repo `n3urs/dynamic` → already shows as `n3urs/Crux` on GitHub but the git remote URL still says `dynamic.git`

**Production env file:**
- All secrets should be in `/etc/crux.env`, loaded by the systemd service
- Document which vars are required vs optional

---

### PRIORITY 6 — Monitoring & Backups

**Uptime monitoring:**
- Set up a free uptime monitor (e.g. UptimeRobot or Better Uptime) on `cruxgym.co.uk` and the EC2 server
- Alert Oscar if the server goes down

**Database backups:**
- Cron job to back up `data/platform.db` and all `data/gyms/*/gym.db` files
- Back up to S3 (eu-west-1) daily, keep 30 days
- Script: `scripts/backup.sh`

**Error logging:**
- Currently errors just go to stdout/systemd journal
- Consider adding a simple error log file or Sentry (free tier) for catching crashes

---

### PRIORITY 7 — UX Polish

**Error pages:**
- Custom 404 page (nginx) — branded, links back to cruxgym.co.uk
- Billing expired page — already exists (billing gate UI), but review UX
- "Gym not found" page — if subdomain doesn't match any gym

**Mobile responsiveness:**
- Staff app (app.html) — audit on mobile, particularly POS and member profiles
- The desk check-in flow should work well on a tablet (portrait orientation)

**Print support:**
- Member QR code: "Print QR" button on member profile → printable A6 card
- Day pass receipt: printable format
- Staff rota / end-of-day report: print-friendly layout

**Loading states:**
- All API calls should have loading spinners / skeleton screens
- Avoid blank white flashes between page loads

---

### FUTURE (no timeline)

- GoCardless direct debit for member recurring payments
- Native iOS/Android app (post-PWA)
- Multi-location support (one gym account, multiple sites)
- Bulk member CSV import
- Booking system (lane/session reservations)
- Push notifications for expiring passes and noticeboard posts
- White-label option (gym uses their own domain, no Crux branding)
- Reseller/franchise support (one account manages multiple gym brands)

---

## Known Issues / Technical Debt

- `server.js` has a UNIQUE constraint error on first startup sometimes — related to waiver template seeding. Usually harmless.
- The `requireBilling` middleware treats missing billing records as "trialing + active" — correct for now.
- Staff PIN login uses a simple hash — fine for now, consider bcrypt for production.
- The `boulderryn-project` folder and GitHub repo should be renamed to `crux` or `cruxgym`.
- YouTube embeds use `youtube-nocookie.com` with `referrerpolicy="origin"` — works on live domain, may have issues on localhost with some ad blockers.

---

## Integration — Connecting All The Parts (NEEDS WORK)

The different parts of the platform exist but aren't coherently linked together. A user shouldn't need to know URLs — everything should flow naturally.

### Current gaps

**1. Marketing site → App**
- `cruxgym.co.uk` has no working "Sign Up" or "Log In" buttons yet
- Fix: update the marketing site nav/CTAs to link to `cruxgym.co.uk/signup` and `cruxgym.co.uk/login`

**2. Login → right place**
- After a gym owner logs in at `cruxgym.co.uk/login`, they need to be routed to `gymname.cruxgym.co.uk`
- If a staff member logs in, same — route to their gym's subdomain
- The login page needs to know which gym the user belongs to (look up by email)

**3. Member registration link not surfaced in staff app**
- Staff need to be able to share `gymname.cruxgym.co.uk/register` with new members (print it, show on a tablet, send via email)
- Fix: add a "Member Registration Link" widget in the staff dashboard — shows the URL + QR code to print/display

**4. Member portal link not surfaced**
- Once built, members need to know `gymname.cruxgym.co.uk/me` exists
- Fix: include the link in the member welcome email (sent after waiver registration) and on the registration confirmation page

**5. Super-admin access**
- Oscar (platform owner) needs a clear, bookmarkable URL to get to the super-admin panel
- Currently at `[server-ip]:8080/admin` or via Cloudflare tunnel — not obvious
- Fix: once production DNS is stable, decide if it lives at `admin.cruxgym.co.uk` or `cruxgym.co.uk/admin`
- Document the URL and token somewhere Oscar can find it (credentials.md)

**6. Billing / account management from within the gym app**
- Gym owners need to be able to get back to their Stripe billing portal from inside the app
- Fix: Settings → Billing tab already exists — ensure it has a working "Manage Subscription" button linking to Stripe portal

**7. Email links**
- Welcome email (sent on provisioning) should link directly to the gym's subdomain
- Member registration confirmation email should include link to member portal (`/me`) once built
- Staff invite email should link directly to the invite acceptance page

### All the URLs, mapped out

| What | URL | Status |
|------|-----|--------|
| Marketing site | `cruxgym.co.uk` | Live |
| Signup | `cruxgym.co.uk/signup` | Built, needs CTA from marketing site |
| Login | `cruxgym.co.uk/login` | Built, needs CTA from marketing site |
| Gym staff app | `gymname.cruxgym.co.uk` | Live |
| Member registration | `gymname.cruxgym.co.uk/register` | Built, needs surfacing in staff app |
| Member portal | `gymname.cruxgym.co.uk/me` | NOT YET BUILT |
| Super-admin | `cruxgym.co.uk/admin` (TBC) | Built, URL not settled |
| Staff invite | `gymname.cruxgym.co.uk/invite/:token` | Built |

---

## Member Portal — Spec (NOT YET BUILT — next major feature)

A member-facing web app / PWA. Members access it at `gymname.cruxgym.co.uk/me`.

### Auth
- Members register via the waiver form (captures their email + creates their account)
- Login: enter email → confirmation code sent → logged in (no password, OTP/magic link style)
- Session persisted in localStorage so they stay logged in on their device
- Members save the link or access it from welcome email
- Future: native app (iOS/Android) — for now PWA only

### What members see

**1. QR Code**
- Their unique entry QR code shown prominently on the home screen
- Tap to go fullscreen (for easy scanning at the desk)
- Shows pass type + expiry date below

**2. Gym Map + Routes**
- The gym's floor plan map (same data as staff gym map builder)
- Zoomable and pannable
- Each route is a marker/pin on the map
- Tap a route → see grade, colour, setter name, date set
- "Mark as sent" button — saves to their personal logbook (stored per member in DB)
- Routes section = member logbook (their sends history)

**3. Noticeboard**
- List of announcements from the gym, newest first
- Only managers/owners can post (from within the staff app)
- Each post has title, body, optional image, date
- Members see new posts highlighted / badge on noticeboard tab

### PWA
- Installable to phone home screen (no App Store)
- `manifest.json` already exists in `/src/public/` — extend it
- Add a service worker for basic offline support (cache the map + last-seen noticeboard)
- Theme colour: gym's brand colour (or Crux navy `#1E3A5F` as fallback)

### Backend routes needed
- `POST /me/auth/request` — send OTP to email
- `POST /me/auth/verify` — verify OTP, return session token
- `GET /me/profile` — member profile, pass status, QR code data
- `GET /me/map` — gym map + routes (same as staff map, read-only)
- `POST /me/routes/:id/send` — mark route as sent
- `DELETE /me/routes/:id/send` — unmark
- `GET /me/logbook` — member's sends history
- `GET /me/noticeboard` — list of posts
- `POST /api/noticeboard` — create post (managers only, requires auth + role check)
- `DELETE /api/noticeboard/:id` — delete post (managers only)

### DB changes needed
- `member_sends` table: `member_id`, `route_id`, `sent_at`
- `noticeboard` table: `id`, `gym_id`, `title`, `body`, `image_url`, `created_by`, `created_at`
- `member_sessions` table (or use JWT): for OTP auth tokens

---

## Marketing Website

Separate from the app. Lives at `/home/ec2-user/.openclaw/workspace/crux-website/` and is served by nginx from `/var/www/cruxgym/`.

- 4 pages: index.html, features.html, pricing.html, contact.html
- Contact form handler: `crux-website/form-handler.js` running as systemd service `crux-form-handler` on port 3001
- Emails go to `cruxgymhq@gmail.com` (hello@cruxgym.co.uk forward)

---

## Useful Commands

```bash
# Self-serve signup (test in browser)
open http://localhost:8080/signup

# Check app server status
curl http://localhost:8080/api/gym-info

# Check admin panel
curl "http://localhost:8080/admin/gyms?adminToken=YOUR_TOKEN"

# Check billing status
curl "http://localhost:8080/billing/status?gymId=mygym"

# Provision a gym
curl -X POST http://localhost:8080/admin/provision?adminToken=YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{"gymId":"testgym","gymName":"Test Gym","ownerEmail":"test@example.com"}'

# Restart form handler
sudo systemctl restart crux-form-handler

# Nginx reload
sudo systemctl reload nginx

# Cloudflare tunnel (for testing)
/usr/local/bin/cloudflared tunnel --url http://localhost:8080
```

---

## Road to Launch — Big Picture

The roadmap above covers the technical build. This section covers everything else needed to go from "feature complete" to "live product with paying customers".

---

### STAGE 1 — Feature Complete ← we are roughly here
- All 7 priority items in the roadmap above done
- Full end-to-end trial run completed (provision test gym → setup wizard → members → payments → emails → member portal)
- No critical bugs or broken flows

---

### STAGE 2 — Legal & Compliance (do in parallel with tech build)

These are non-negotiable before taking real customer money in the UK.

- [ ] **Privacy Policy** — add `/privacy` page to cruxgym.co.uk (what data you collect, how it's stored, UK GDPR compliant)
- [ ] **Terms of Service** — add `/terms` page (subscription terms, cancellation, liability, acceptable use)
- [ ] **Data Processing Agreement (DPA)** — gyms are processing their members' personal data on your platform; you need a DPA they accept during signup
- [ ] **Cookie policy** — basic, just document what cookies the app sets
- [ ] **ICO registration** — required in the UK if you're processing personal data commercially (£40/year, done online at ico.org.uk)
- [ ] **Business entity** — are you trading as a sole trader or limited company? Affects Stripe, invoicing, and liability
- [ ] **VAT** — not required until £90k turnover but worth knowing the threshold

---

### STAGE 3 — Pre-Launch Testing

- [ ] Full end-to-end trial: sign up as a fake gym owner → complete setup wizard → add staff → invite them → register a member (waiver) → check them in → POS transaction → check all emails sent correctly → view member portal
- [ ] Test Stripe checkout: use test card `4242 4242 4242 4242` through the full signup flow
- [ ] Test trial expiry: fast-forward a gym's trial end date in the DB and confirm the billing gate activates correctly
- [ ] Test on mobile: staff app on a phone, member portal on a phone, registration form on a phone
- [ ] Test the member portal PWA install on iOS and Android
- [ ] Basic security review: check all admin/staff routes reject unauthenticated requests, no sensitive data in public routes

---

### STAGE 4 — Soft Launch (Beta — 1-2 real gyms, free or heavily discounted)

The goal is real-world validation before charging full price.

- [ ] Identify 1-2 UK climbing gyms willing to beta test (BoulderRyn is the obvious first candidate — Oscar works there)
- [ ] Provision their gym, walk them through setup in person or on a call
- [ ] Collect feedback: what's confusing, what's missing, what's broken
- [ ] Fix critical issues before wider launch
- [ ] Get a testimonial / case study if it goes well

---

### STAGE 5 — Go-To-Market

- [ ] **Pricing page CTA works end-to-end** — "Start Free Trial" on cruxgym.co.uk goes to `/signup`, completes, gym is live
- [ ] **Demo/sales flow** — can Oscar give a live demo to a gym owner? Script out a 10-minute walkthrough
- [ ] **Support plan** — how do gyms get help? Minimum: hello@cruxgym.co.uk + a basic help doc or FAQ
- [ ] **Outreach list** — identify UK bouldering/climbing gyms to contact (Moon Climbing, Boulder Brighton, etc.)
- [ ] **LinkedIn/Instagram presence** — optional but helps with credibility when gyms look you up

---

### STAGE 6 — Public Launch

- [ ] Remove "coming soon" banners from cruxgym.co.uk
- [ ] Signup flow live and tested
- [ ] First paying customer onboarded
- [ ] Monitoring active (uptime alerts, DB backups)
- [ ] Oscar can log into super-admin and see real data

---

### Where we are right now

```
[Stage 1: Feature Complete] ████████░░  ~80% — member portal + integration left
[Stage 2: Legal]            ░░░░░░░░░░  ~0%  — not started
[Stage 3: Testing]          ░░░░░░░░░░  ~0%  — not started
[Stage 4: Beta]             ░░░░░░░░░░  ~0%  — not started
[Stage 5: Go-To-Market]     ░░░░░░░░░░  ~0%  — not started
[Stage 6: Launch]           ░░░░░░░░░░  ~0%  — not started
```

Realistically: finish the tech (4-6 more Claude Code sessions), then legal (1-2 weeks parallel), then beta (2-4 weeks), then launch.
