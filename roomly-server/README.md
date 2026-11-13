# Roomly API

Express + MongoDB (Mongoose) backend for the Roomly frontend. It implements exactly the REST contract the frontend's `services/` layer calls, so connecting the two is one environment variable.

## Quick start

```bash
cp .env.example .env            # then set JWT_SECRET (32+ chars)
docker compose up -d            # MongoDB on :27017   (or use your own / Atlas via MONGODB_URI)
npm install
npm run seed                    # optional: demo household "Casa 4" (rahul@roomly.app / roomly123)
npm run dev                     # http://localhost:5000/api/health
```

Connect the frontend: in the client project set `VITE_API_URL=http://localhost:5000/api` and restart `npm run dev`.
(With `VITE_API_URL` empty the client keeps using its built-in mock API.)

`docker compose --profile api up --build` runs MongoDB **and** the API in containers (needs `JWT_SECRET` in your environment).

## Scripts

| | |
|---|---|
| `npm run dev` | start with auto-reload |
| `npm start` | production start |
| `npm run seed` / `npm run seed -- --reset` | load demo data / wipe the DB then load it (refuses in production) |
| `npm test` | 102 integration tests (needs a MongoDB at `MONGODB_URI` in `.env.test`) |
| `npm run whatsapp:doctor` | check your WhatsApp Cloud API setup |

Seed data is anchored to the **current month**: 47 expenses totalling ₹18,420 (Rahul ₹5,240 · Aman ₹4,180 · Vikas ₹4,320 · Kunal ₹4,680, fair share ₹4,605) plus three fully-settled past months. Early in a month the dates are compressed so nothing is dated in the future.

## API

All routes are under `/api`, JSON in/out, `Authorization: Bearer <token>` unless noted. Errors are `{ "message": "<friendly text>" }` with a meaningful status (400/401/403/404/409/422/429/500).

| Method & path | Purpose |
|---|---|
| `GET /health` | liveness (no auth) |
| `POST /auth/register` · `/login` | → `{ token, user }` (no auth) |
| `POST /auth/forgot-password` · `/reset-password` | email a reset link / set a new password (no auth) |
| `POST /auth/logout` · `GET /auth/me` · `PATCH /auth/me` · `POST /auth/change-password` | session and profile (name, email, avatar `tone`) |
| `GET /households` · `POST /households` | your households / create one |
| `POST /households/join` `{inviteCode}` | join by invite code (claims an invited placeholder with the same email) |
| `PUT /households/current` `{householdId}` | switch active household |
| `GET` · `PATCH /households/current` | read / rename (admin) |
| `POST /households/current/invite-code` | rotate the invite code (admin) |
| `GET /households/current/members` · `POST …/invites` | list / add a housemate by name (+ optional email) |
| `DELETE /households/current/members/me` · `…/members/:id` | leave / remove a member (admin) |
| `GET /expenses?month&q&members&categories&from&to&minAmount&maxAmount` | list (newest first); `q` searches title, category, person, note |
| `POST /expenses` · `GET`/`PATCH`/`DELETE /expenses/:id` · `POST /expenses/:id/restore` | CRUD + undo-delete |
| `POST /uploads/receipts` `{dataUrl}` | store a receipt image → `{ url }` |
| `GET /settlements/:month` | totals, fair share, per-member balances, simplified payments |
| `POST` · `DELETE /settlements/:month/transactions/:txId/pay` | mark paid / undo |
| `GET /summaries/:month` · `GET /months` | monthly report data / history list |
| `GET /whatsapp/status` · `POST /whatsapp/link-code` · `DELETE /whatsapp/link` | WhatsApp linking for the current user |
| `POST` · `DELETE /whatsapp/group` · `POST …/group/invite-link` · `PATCH /whatsapp/settings` | household group + confirmation setting (admin) |
| `GET /whatsapp/activity` · `POST /whatsapp/parse` · `POST /whatsapp/simulate` | recent chat activity · "Try it" preview · dev-only simulator |
| `GET /events` | live update stream (Server-Sent Events) |
| `GET` · `POST /webhooks/whatsapp` | Meta's webhook (signature-verified, no JWT) |
| `GET /notifications` · `POST /notifications/:id/read` · `POST /notifications/read-all` | |

## How it works

- **Money is derived, never stored.** Settlement, balances and the minimal set of payments are recomputed from expenses on every request (`utils/settlement.js` is the same algorithm as the client). Only *payments* are stored, matched by transaction id **and** amount — so if an expense changes after someone paid, the stale payment stops counting and the month honestly reopens.
- **Whole rupees.** Amounts are integers; shares are split so they always add up exactly (₹14,250 ÷ 4 → 3563, 3563, 3562, 3562).
- **Member id = user id.** A household member who has an account shares the user's `_id`; invited-but-not-joined people get their own id, which is swapped for the real user id (and re-pointed on every expense) when they join.
- **Closed months.** A past month where everyone has paid is locked (`409`) against edits, deletes and new expenses.
- **People who leave** stay in the maths for months where they paid for something, so balances always sum to zero. If the admin leaves, someone else is promoted; an empty household is deleted.
- **Permissions.** Any member can add an expense. Edit/delete/restore: the payer, whoever added it, or an admin. Marking a payment: the payer, the receiver, or an admin. Rename, rotate code, remove member: admin.
- **Dates** (today, month boundaries) use `APP_TIMEZONE` (default `Asia/Kolkata`).

## WhatsApp chat export import (Roomly flow)

The household admin can upload a WhatsApp **Export chat → Without media** `.txt` file from the Roomly **Import chat** page. The import API supports common Android and iOS text-export headers.

- `POST /api/imports/whatsapp` accepts `{ filename, content }`; authenticated household admins only.
- The parser uses the existing conservative WhatsApp expense parser and keeps only expense-candidate message text for review. Non-expense messages are represented by fingerprints/status only.
- Message fingerprints are unique per household and include normalized sender, timestamp and message content. Re-uploading the same export skips already-seen messages.
- `GET /api/imports` lists recent import batches; `GET /api/imports/:id/review` returns pending candidates and household members.
- `POST /api/imports/:id/review` accepts decisions with `messageId`, `action` (`approve` or `reject`), and for approvals `paidBy`, `amount`, `title`, and `category`.
- Imported expenses are not added to the ledger until the admin approves them. The import history remains as an audit/deduplication record.

The frontend page is available at `/app/imports`. This first iteration imports text messages only; media/receipt OCR, advanced sender aliases, configurable custom splits, and public dashboard links are separate follow-on work.

## WhatsApp

Housemates can log expenses by texting — `vegetables 150rs` — through the **official WhatsApp Cloud API**. Two ways, both built:

1. **Message the Roomly bot** — each person links their number once (Settings → WhatsApp shows a one-time code and QR), then DMs the bot. Works on any Cloud API number, including Meta's free test number.
2. **A household group Roomly creates** (Groups API) — people join by invite link and text in the group. **Needs an Official Business Account**, max 8 people per group. Off unless `WHATSAPP_GROUPS_ENABLED=true`.

> **What the official API can't do:** a bot cannot be added to an *existing* WhatsApp group or read old messages. Roomly *creates* the group instead. Plan accordingly if you were hoping for "add the bot to our current group".

### What the bot understands

`vegetables 150rs` · `petrol 500` · `₹1,850 groceries` · `paid 450 for sabzi` · `yesterday milk 60` · `doodh 60` (Hinglish) · plus `balance`, `total`, `undo` (removes *your* last WhatsApp expense from the past 15 minutes), `help`.
Chat like "come at 5 pm", "who's buying milk?", "I'll pay 200 tomorrow", "sent 500 to Rahul" is ignored. In groups only short, clear messages are recorded; DMs also accept longer sentences. The parser (`src/services/whatsapp/parser.js`) is the same file the frontend uses for its "Try it" box, and both run the same fixtures (`tests/fixtures/parser-cases.json`).

### WhatsApp setup (about 30 minutes, once)

1. **Meta Developer account** → create an app of type *Business* → add the **WhatsApp** product. Meta gives you a free **test number** and a *Phone number ID* immediately — enough to try everything except groups.
2. **Permanent access token:** Business Settings → Users → **System Users** → add a system user → assign your WhatsApp account → *Generate token* with `whatsapp_business_messaging` and `whatsapp_business_management`. (The token on the API Setup page expires in ~24 h — don't use it in production.)
3. Copy into `.env`: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` (App settings → Basic), `WHATSAPP_DISPLAY_NUMBER` (digits only). Invent a long random `WHATSAPP_VERIFY_TOKEN`.
4. Your API must be reachable over **HTTPS** (Meta calls it). Locally use a tunnel (`ngrok http 5000`) and set `PUBLIC_URL` to the https URL.
5. In Meta → WhatsApp → **Configuration → Webhook**: callback URL `https://YOUR-HOST/api/webhooks/whatsapp`, verify token = your `WHATSAPP_VERIFY_TOKEN`, **Verify and save**, then subscribe to **messages** (and, for groups, `group_lifecycle_update`, `group_participants_update`, `group_settings_update`, `group_status_update`).
6. Run `npm run whatsapp:doctor`. It checks every credential, makes a live call to Meta, and prints exactly what to fix.
7. To go beyond the test number: add your own number, complete **business verification**, and add a payment method.

While the app is in *development* mode, only people you add as testers can message the test number.

### Develop without Meta

Set `WHATSAPP_SIMULATOR=true`. The Settings → WhatsApp page then shows a "Development only" box that feeds messages through the **real** processor as any housemate and shows the bot's replies; `POST /api/whatsapp/simulate` does the same. Group creation succeeds instantly with a fake invite link. The server **refuses to start** with the simulator on in production.

### Costs

Meta bills **per message** now (the old "1,000 free conversations" model is gone). Replies inside the 24-hour customer-service window are free; group messages are billed under their own *group* categories. Check Meta's current pricing page for your country before launch. A household texting a few dozen expenses a month is tiny, but confirm.

### How it behaves in production

- **Signature-verified.** Every webhook is checked against `X-Hub-Signature-256` (HMAC-SHA256 of the raw body, keyed with the app secret, constant-time compare) before it is parsed. Unsigned or altered requests get 401.
- **Safe to retry.** Each inbound message id is stored once (unique index), so Meta's retries never create duplicates. If processing fails mid-way the server answers 5xx and *removes* the marker, so the retry is processed exactly once.
- **A failed reply never loses an expense.** The expense is saved first; the confirmation is best-effort with a 10 s timeout and one retry.
- **Privacy.** Messages that aren't expenses are stored as an outcome only — no text. Expense messages keep ≤ 80 characters for the activity feed. Rows expire after 90 days (TTL index). Phone numbers are never sent to browsers (only `•••• 4321`). Groups Roomly didn't create are never read. Logs contain status/error codes, never message text or tokens.
- **Linking.** Single-use, 10-minute codes (hashed at rest); only accepted in a private chat; 8 attempts/hour per number; one number per account. A code is redeemed by whoever sends it first, so don't paste it anywhere public — the Settings page shows the masked number that got linked so you can spot a mistake, and you can unlink instantly.
- **Live updates.** `GET /api/events` is a Server-Sent Events stream that pushes `expense.created` etc. to every open tab. It is in-process, so with more than one API instance swap `services/events.js` for Redis pub/sub.
- **Behind nginx**, disable buffering for the stream:
  ```nginx
  location /api/events { proxy_pass http://api:5000; proxy_http_version 1.1; proxy_set_header Connection ""; proxy_buffering off; proxy_read_timeout 1h; }
  ```

### Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Verify and save" fails in Meta | Wrong `WHATSAPP_VERIFY_TOKEN`, or the URL isn't public HTTPS |
| Messages never arrive | Webhook not subscribed to `messages`; app in dev mode and sender isn't a tester; run `npm run whatsapp:doctor` |
| Webhook returns 401 | `WHATSAPP_APP_SECRET` doesn't match the app that owns the number |
| Bot stops replying after ~24 h | You're using a temporary token — create a System User token |
| "Groups need an Official Business Account" | Your number isn't eligible for the Groups API; use the DM bot |
| Someone texts and nothing happens | Their number isn't linked (the bot says so in a DM; in a group it hints once), or the message looked like chat |
| Expense says "month already settled" | Fully-paid past months are locked by design |

### Not verified against live Meta

The Graph API calls and webhook payload shapes follow Meta's documentation, but this environment has no Meta credentials, so they have been tested against a **fake Meta that checks the exact requests and payloads**, not the real service. In particular the group-creation response/webhook correlation (`request_id`) is handled defensively but untested live. Run `npm run whatsapp:doctor` and try the test number first; expect to tweak little, but verify.

## Security

bcrypt (cost 12) · JWT with a per-user `tokenVersion` (changing/resetting a password signs out every device) · same 401 for unknown email vs wrong password · rate limiting (30 auth attempts / 15 min / IP, 600 requests / min) · helmet · CORS locked to `CLIENT_ORIGIN` · every input validated with zod (unknown fields stripped) · every household query is scoped by the caller's membership · receipt uploads accept raster images only (no SVG), ≤ 5 MB, random 128-bit filenames, served with `nosniff` + sandbox CSP.

## Things to know

- **Receipts are stored on local disk** (`UPLOAD_DIR`). For production, replace the single `fs.writeFile` in `controllers/uploadController.js` with an S3/Cloudinary upload and return that URL; nothing else changes. Mount a persistent volume if you keep local storage.
- **Password-reset emails** use SMTP when `SMTP_HOST` is set; otherwise the link is printed to the server log. The link points to `CLIENT_URL/reset-password?token=…` — the current frontend has no page for that yet.
- **Not yet surfaced in the frontend UI** (the API supports them): join by invite code, rotate invite code, remove member, undo a payment, reset-password page.
- Behind a proxy/load balancer? Production mode already sets `trust proxy` to 1 hop.
- The TTL index that expires notifications after 90 days is standard MongoDB; set `DISABLE_TTL_INDEX=true` only on Mongo-compatible databases that lack it.

## How this was tested

The 25 integration tests (auth, households, invites, expenses CRUD/filters/search, permissions, tenant isolation, receipts, notifications, settlement maths on the ₹18,420 scenario, closed months, leaving members, CORS) were run against **FerretDB**, a MongoDB-compatible server, because real `mongod` couldn't be installed in the build environment. The client's own screens were also rendered against this server (seeded) to confirm the contract. Please run `npm test` once against a real MongoDB before relying on it; I expect no differences, but I haven't verified that.
