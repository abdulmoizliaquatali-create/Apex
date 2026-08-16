# Security Policy

## Supported versions

Security fixes are applied to the latest release and, where feasible,
backported to the previous minor release.

| Version | Supported          |
| ------- | ------------------ |
| 1.7.x   | :white_check_mark: |
| < 1.7   | :x:                |

## Reporting a vulnerability

Please do **not** open a public issue for security vulnerabilities. Instead
email the maintainers directly, or report privately through GitHub's
advisory workflow.

Please include:

- The affected version(s) and endpoint/file if known
- A description of the issue and its impact
- Reproduction steps if available

You will receive an acknowledgement within 5 business days, and we will work
on a fix before disclosing publicly.

## Security notes for operators

- Use a strong random `AUTH_SECRET` in production; tokens are signed with it.
- The backend's `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security —
  keep it **server-side only** and never expose it to the browser.
- `GET /api/export` and `POST /api/restore` are administrator-only; the backup
  contains password hashes, so protect any exported files.
- Demo credentials are seeded for convenience. Change passwords in
  **Admin & Settings → Users & Roles** before going live, and deactivate
  unused accounts.
