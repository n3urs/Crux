# Build Log

## Architecture Change: Electron → Web App (March 2026)

Converted from Electron desktop app to a standard web application:
- **Before:** Electron + IPC handlers + preload bridge
- **After:** Express.js server + REST API + static frontend
- All existing functionality preserved — only the transport layer changed (IPC → HTTP)
- Frontend uses `fetch()` to hit `/api/*` endpoints instead of `window.api` IPC calls
- Database (SQLite/better-sqlite3) and all models unchanged
- Schema unchanged

### Files created:
- `server.js` — Express server (entry point)
- `src/routes/*.js` — 13 API route files (members, checkin, products, transactions, passes, waivers, giftcards, events, routes, analytics, staff, settings, stats)
- `src/public/` — static frontend (moved from src/renderer/)
- `src/public/app.js` — updated to use fetch() API
- `src/public/pages/pos.js` — updated to use fetch() API
- `src/public/pages/waiver.js` — updated to use fetch() API
- `.gitignore`

### Files modified:
- `package.json` — removed electron, added express, updated scripts
- `src/main/database/db.js` — removed Electron app.getPath dependency

### Files superseded (kept for reference):
- `src/main/main.js` — original Electron main process
- `src/main/preload.js` — original IPC bridge
- `src/renderer/` — original frontend (copied to src/public/ with modifications)

---

## Module 1–4: Core Functionality

### Completed:
- Database schema (29 tables) — `src/shared/schema.sql`
- Member management (CRUD, search, QR codes, family links)
- Check-in system (QR scan, pass validation, waiver checking)
- POS (product grid, cart, card/gift card payment)
- Pass management (15 default types, issue, pause, cancel, extend, transfer)
- Waiver system (adult + minor forms, video, digital signature)
- Transaction recording (line items, receipts, daily summary, refunds)
- Gift card system
- Event/course/slot booking (API complete)
- Route management + competitions (API complete)
- Analytics (footfall, revenue, member retention, KPIs) (API complete)
- Staff management + auth (API complete)
- Settings management

### Frontend pages implemented:
- Dashboard (stats cards, quick actions)
- Check-in (QR scan, name search, pass/waiver validation)
- Members (list, search, detail modal, registration form)
- POS (product grid, cart, payment flow, daily summary)
- Waiver signing (video + form + signature canvas)
- Events, Routes, Analytics, Staff — placeholder pages (API ready)
