# Roomly — Shared living, simplified.

A premium, mobile-first React frontend for households that split expenses.
Runs fully offline against a built-in mock API, and is designed to swap to a real Express/MongoDB backend by setting one env var.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build
npm test             # route smoke tests + end-to-end money-flow test
```

Open the app and click **Explore the demo household** on the login screen (or sign in with `rahul@roomly.app` / `roomly123`).
You land in **Casa 4 — October 2026**: 47 expenses, ₹18,420 total, four members.

## The demo numbers (all derived, nothing hard-coded)

| Member | Paid | Fair share | Balance |
|---|---|---|---|
| Rahul | ₹5,240 | ₹4,605 | +₹635 |
| Kunal | ₹4,680 | ₹4,605 | +₹75 |
| Vikas | ₹4,320 | ₹4,605 | −₹285 |
| Aman | ₹4,180 | ₹4,605 | −₹425 |

Fewest-payments settlement: Aman → Rahul ₹425, Vikas → Rahul ₹210, Vikas → Kunal ₹75.
Balances are computed from expenses on every request, so add/edit/delete an expense and everything updates.
(The product brief's sample "Vikas −₹505 / Kunal owes Rahul ₹135" contradicted its own contribution figures, so Roomly uses the maths.)

"Today" is pinned to **28 Oct 2026** in mock mode so the seed data always looks live.

## Architecture

```
UI component → hook (TanStack Query) → service → api client → REST
                                                     └─ mock server (in-browser) when VITE_API_URL is empty
```

- `src/services/*` call REST endpoints only (`/auth`, `/households`, `/expenses`, `/settlements`, `/summaries`, `/months`, `/notifications`, `/uploads/receipts`).
- `src/mock/server.ts` implements those same routes in memory (persisted to localStorage). **To go live:** set `VITE_API_URL=http://localhost:5000/api` and implement the same routes in Express. No UI code changes.
- `src/services/expenseService.uploadReceipt` is the single place to swap in S3/Cloudinary presigned uploads.
- Server state → TanStack Query. Auth → `AuthProvider`. UI state (theme, toasts, expense composer) → small context providers. Everything else stays local.
- 401 from any request clears the session and routes to login. Errors are mapped to friendly copy in `utils/errors.ts`.
- All colours live in `src/styles/index.css` as CSS variables (light + dark), consumed through `tailwind.config.js`.

## WhatsApp chat import

The household admin can open **Import chat** in the sidebar and upload a WhatsApp `.txt` export (Export chat → Without media). Roomly fingerprints messages per household, skips previously imported messages, detects expense candidates, maps senders to members, and queues candidates for admin approval before creating expenses. Import review history is retained so a full export can safely be uploaded again later.

**Share dashboard** creates a revocable, expiring, read-only link. Admins can optionally include member contribution totals and share the link directly to WhatsApp.

The old WhatsApp Cloud API bot implementation remains in the backend for compatibility, but it is no longer part of the primary frontend workflow.

## Keyboard

`N` add expense · `/` focus search (Expenses) · `⌘/Ctrl + K` command menu · `Esc` closes any dialog · `←/→` in Wrapped.

## Demo tools

Settings → Demo tools (mock mode only): simulate server errors to review error states, or reset the demo data.
