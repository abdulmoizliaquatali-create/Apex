# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Backup export (`GET /api/export`) is now restricted to administrators — it
  previously exposed the full database, including password hashes, without
  authentication.
- Cleaned up a leftover broken loop in the Supabase loader
  (`backend/supabase.js`) that added junk keys to the in-memory database.
- Removed a duplicate sortable column key on the Sales "Outstanding" column.

## [1.7.0] - 2026-08-16

### Added
- **Login & role-based access**: email/password sign-in with `admin`,
  `accountant` and `viewer` roles.
  - Backend: `POST /api/login`, `GET /api/me`, HMAC-signed 12-hour tokens,
    SHA-256 password hashing, boot migration that back-fills passwords for
    pre-existing users.
  - Frontend: login screen with demo-account autofill, `AuthProvider` session
    handling (localStorage), route guard, topbar user menu with sign-out.
  - Role enforcement: administrators alone can manage settings, users, modules,
    backup/restore and force-sync; viewers are read-only (enforced on the
    server, not just the UI).
- **List power tools**: sortable columns (numeric-aware), live filter bar and
  pagination on Sales, Purchases, Products, Contacts, Accounting and Banking.
- **Print support**: one-click browser printing with print-only CSS across all
  lists, Accounting and Reports (PDF export unchanged).
- **Supabase persistence (optional)**: PostgREST adapter with no SDK
  dependency, env-gated load + debounced write-through sync, manual
  `POST /api/sync` flush, graceful shutdown flush, schema migration with RLS
  and indexes, and setup docs. Falls back to the local JSON store when
  unconfigured.
- Minimal dependency-free `.env` loader for the backend.

## [1.6.0] - 2026-08-12

### Added
- Designer-level UI/UX overhaul: premium glassmorphism design system,
  animated ambient background, refined typography, cards, buttons and
  micro-interactions (with `prefers-reduced-motion` support).
- Theme-aware charts (gradient bars, draw animations), `Sparkline` / `Trend`
  components, redesigned `Stat` cards.
- Dashboard hero banner, stat sparklines, low-stock progress bars and a recent
  transactions table.

## [1.5.0] - 2026-08-12

### Added
- **Glassmorphism light/dark theme** with system-preference detection and a
  persisted `apex-theme` preference; sun/moon toggle in the topbar.
- **Automatic FX rate sync** from `open.er-api.com` (USD base) with a static
  fallback snapshot, boot refresh, `FX_REFRESH_HOURS` scheduler, live/fallback
  badges and manual refresh in the Currencies tab.

## [1.4.0] - 2026-08-12

### Added
- Split deployment: Netlify (frontend SPA) + Render (backend API) with
  `VITE_API_URL`, `netlify.toml` and static-frontend serving from the backend.

## [1.3.0] - 2026-08-12

### Added
- Single-service production build with a Render blueprint; lazy-loaded PDF
  export to keep the main bundle small.

## [1.2.0] - 2026-08-11

### Added
- PKR reporting base currency with live display conversion via a shared `fmt()`
  helper; currency switching from the topbar; repo hardening (gitignore,
  README, seed consistency).

## [1.1.0] - 2026-08-11

### Added
- Base currency switching, PDF document/report export, admin panel
  (company profile, preferences, currencies, bank accounts, users, modules,
  backup), and workflow automation (quote → order → invoice, purchase order →
  receive → bill, payments, stock adjustments, voiding).

## [1.0.0] - 2026-08-05

### Added
- Initial trading & accounting suite for Apex Gloves: double-entry ledger,
  sales/purchasing/inventory/contacts/banking/accounting/reports modules,
  seeded multi-currency demo dataset, and PDF exports.

[Unreleased]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.7.0...HEAD
[1.7.0]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/abdulmoizliaquatali-create/Apex/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/abdulmoizliaquatali-create/Apex/releases/tag/v1.0.0
