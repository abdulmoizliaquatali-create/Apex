# Contributing to Apex ERP

Thanks for taking the time to contribute! Please read the project
[README](README.md) first to understand the architecture, then follow the
guidelines below.

## Development setup

```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Run both services (the frontend proxies /api to the backend)
./start.sh
```

- Backend API: http://localhost:3001
- Frontend app: http://localhost:5173

## Code style

- **Frontend**: TypeScript via `tsc -b`. Keep components in
  `frontend/src/components`, pages in `frontend/src/pages`. Use the shared UI
  kit and list toolkit (`list.tsx`) rather than hand-rolled tables.
- **Backend**: plain Node ESM (`.js`). Keep route handlers thin; put business
  logic in `ledger.js` and persistence in `store.js`.
- Do not add comments unless they explain *why* something is done.
- Keep the two projects lint/type-clean: `npm run build` must pass in
  `frontend/` and every backend file must pass `node --check`.

## Pull requests

1. Create a focused branch: `YYMMDD-feat-<summary>` (or `fix-`, `chore-`).
2. Make changes, add tests where practical, and verify:
   ```bash
   cd frontend && npm run build
   node --check backend/server.js
   ```
3. Write a clear commit message using conventional commits:
   `feat(scope): summary`, `fix(scope): summary`, `chore: summary`.
4. Open a pull request with a short description of the change and why it is
   needed. Reference any related issue.

## Reporting issues

Please include:

- Steps to reproduce
- Expected vs actual behaviour
- Browser/OS and any relevant console output
- Whether you are running the JSON store or Supabase mode

## Security

Do not include real credentials (Supabase keys, `AUTH_SECRET`) in commits or
issues. See [SECURITY.md](SECURITY.md) for how to report a vulnerability.
