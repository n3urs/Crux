# BoulderRyn Gym Management Software

## Project Overview
Web-based management system for BoulderRyn climbing gym in Penryn, Cornwall.
~250 visitors/day, card-only payments (Dojo reader + GoCardless DD).

## Tech Stack
- **Framework:** Node.js / Express (web app)
- **Frontend:** HTML/CSS/JavaScript — served as static files
- **Backend:** Express REST API
- **Database:** SQLite via better-sqlite3
- **Styling:** Tailwind CSS (CDN) — blue/navy colour scheme, clean, modern
- **Payment (in-person):** Dojo card reader (placeholder until API details provided)
- **Payment (recurring):** GoCardless (placeholder until API keys provided)
- **Email:** Nodemailer via Gmail SMTP

## Running the App
```bash
npm install
npm start
# Open http://localhost:3000
```

## API
All API endpoints are at `/api/*`:
- `/api/members` — member CRUD, search, QR emails
- `/api/checkin` — check-in processing
- `/api/products` — product/category management
- `/api/transactions` — sales, refunds, receipts
- `/api/passes` — pass types, issuing, management
- `/api/waivers` — templates, signing, validation
- `/api/giftcards` — gift card management
- `/api/events` — events, courses, slots
- `/api/routes` — climbs, logbook, competitions
- `/api/analytics` — footfall, revenue, member analytics
- `/api/staff` — staff management, auth, shifts
- `/api/settings` — system settings
- `/api/stats` — dashboard stats

## Branding
- Gym name: BoulderRyn
- Logo: Black and white (exists, not yet provided as file)
- Colour scheme: Navy blue (#1E3A5F) / Bright blue (#3B82F6)
- Card only, no cash

## Gym Layout
- 3 walls: Cove Wall (left), Mothership (centre island), Magical Mystery (right)
- V-scale grading: VB through V9+
- Route colours: Black, Yellow, Green, Purple, Mint, Red

## Waiver System
- Induction video: https://www.youtube.com/watch?v=-r2zbi21aks
- Two forms: Adult and Minor Acknowledgement of Risk
- First-timers must watch video then complete form
- Digital signature required
- See reference/waiver-adult.md for full form spec

## Build Order
1. ~~Core app shell + database schema + member management~~
2. ~~POS + Dojo placeholder~~
3. ~~Waiver system + check-in (QR codes)~~
4. ~~Pass management + GoCardless placeholder~~
5. Events + scheduling + slot booker (API ready, UI pending)
6. Routesetting tools + gym map (API ready, UI pending)
7. Analytics dashboards (API ready, UI pending)
8. Staff admin + permissions (API ready, UI pending)

## Placeholder Items (awaiting from Oscar)
- [ ] GoCardless API keys (sandbox for dev)
- [ ] Dojo card reader model + API/SDK docs
- [ ] BoulderRyn logo file
- [ ] Product list for café/shop (dynamic — can add later)

## Key Decisions
- No cash payments — Dojo card reader only
- No mobile app — QR codes emailed as images
- No turnstile — desk-based check-in with QR scan
- Peak/Off Peak pricing (Peak = Mon-Sun anytime, Off Peak = Mon-Fri 10am-4pm)
- First Time Registration fee: £3 one-off
- Shoe Rental: £3.50
- Converted from Electron desktop app to web app (March 2026)
