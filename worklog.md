# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: Plan and build the Locomotive Service Navigator — an image-map hierarchy web app for a diesel locomotive service factory (Persian RTL UI)

Work Log:
- Clarified 8 design decisions with user: rectangles, Persian RTL UI, SQLite, per-train hierarchy, all-repairmen history, part no + labor hours fields, demo train, PDF log export
- Ran fullstack init script; confirmed Next.js 16 + shadcn + Prisma/SQLite scaffold
- Designed Prisma schema: User (role), Train, PartNode (diagram per node, parentAreaId FK with cascade), Area (percent-rect hotspots, childNode back-relation), ServiceRecord (path snapshot, type, date, partNumber, laborHours); db:push OK
- Built libs: src/lib/jalali.ts (jalaali algorithms, verified 400 samples against Intl fa-IR), src/lib/auth.ts (scrypt hash + HMAC cookie session + requireUser role guards), src/lib/client.ts (typed fetch + Persian labels)
- Layout: dir=rtl, lang=fa, Vazirmatn via next/font/google (self-hosted), amber/rust theme (no blue), print CSS (.print-root), custom scrollbars
- 14 API routes: auth (login/logout/me), trains CRUD + /tree (recursive tree builder), nodes, areas, upload (sharp → webp, admin/operator only), records (GET filters + POST with server-side path snapshot walk), users (admin CRUD, delete blocked when records exist), stats
- Single-page app at / (skill constraint): AppRoot view router + Shell (role-filtered nav, theme toggle, user menu) + LoginView + DashboardView + TrainsView + BuilderView + NavigatorView + ServiceFormModal + RecordsView + ReportView + UsersView + HotspotImage (shared: view/edit/draw modes, pointer-drag rects) + JalaliDateField (3-select Jalali picker, empty-state support) + ImageUpload
- Generated 4 demo diagrams via image-generation skill (vintage engineering print style, 1344x768); VLM used for layout verification (cab side, turbo side, pistons bottom) — precise bboxes were unreliable, used curated boxes informed by VLM answers
- Seed script: 4 users (admin/admin123, operator1/op123456, repairman1+repairman2/rp123456), DL-500 train with 4-level hierarchy (نمای کلی → موتور دیزل → سیلندرها → پیستون → سوپاپ چپ/راست/رینگ), 12 areas, 11 service records with Jalali dates
- Fixed bugs found in verification: lucide `Map` icon shadowed global Map (NavigatorView crash), RecordsView `c` undefined, childNodeId → childNode relation, jalali formatters accept ISO strings, stale-closure in builder load(), setPointerCapture throws on synthetic pointer ids (wrapped in try/catch)
- ESLint clean, tsc clean (src/), dev.log clean

Stage Summary:
- Deliverable: runnable Next.js app on port 3000, Persian RTL, fully verified end-to-end with agent-browser
- Verified flows: login (3 roles, role-filtered nav) · navigator drill-down (train → motor → cylinders → piston → left valve → form with full path + history) · service record submission (history updates) · records table + filters + printable per-train report · builder draw-area → name → create → select → delete · child-diagram linking UI · users create/delete · mobile 390px + dark mode + session persistence
- Demo data: 12 records, hierarchy depth 4, images in public/uploads/seed-*.png
- Scripts kept in scripts/: gen-demo-images.ts, detect-boxes.ts, seed.ts (idempotent), test-jalali.ts
