---
name: Pull request
about: Propose changes to Apex ERP
title: ""
labels: ""
assignees: ""
---

## Summary

What does this PR do and why? Keep it focused on one change.

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Docs
- [ ] Other (describe)

## How has this been verified?

- [ ] `cd frontend && npm run build` passes (type-check + production build)
- [ ] Backend restarted and `POST /api/reset` re-seeded demo data
- [ ] `GET /api/reports/balance-sheet` confirms the books balance
- [ ] Manual QA through the UI (list the screens/flows tested)

## Checklist

- [ ] No `/api` prefix written in frontend page/modal code (api.ts handles it)
- [ ] Money uses the shared `fmt()` helper, not hand-rolled formatting
- [ ] Journal entries stay balanced for any changed postings
- [ ] No debug logging or dead code left behind

## Related issues

Closes #...
