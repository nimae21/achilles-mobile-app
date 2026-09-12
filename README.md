# Achilles Super Admin Mobile

Ionic Vue + Capacitor Android app that gives the Achilles **Super Admin** a mobile console for the
Laravel website in `../caps`. It talks to the existing Achilles API and database — no second backend, no
mobile-only copies of records.

## Who can use it

Only an active account with `role = super_admin` can sign in. The backend rejects Admins and Customers
with **403** even when their password is correct, and every endpoint is guarded by
`auth:sanctum` + `active` + `super_admin`, so hiding a screen in the app is never the security boundary.

## Modules

| Tab | What it does |
| --- | --- |
| Dashboard | System overview: sales, orders by state, catalog/inventory totals, accounts, approvals, alerts, recent orders and recent activity. Every card opens its module. |
| Orders | Search + status filters + pagination, and a full order detail (customer, delivery, items, payment, status timeline). **Read-only**: the Super Admin has never been able to ship, complete or cancel on the website, so there is no such endpoint here. |
| Approvals | Pending/approved/rejected queue with bulk selection, request detail (proposed fields + images), approve or reject with a reason. Reviews go through `ApprovalService`, the same workflow the website uses. |
| Users | Customer list with status filters, account detail, suspend/reactivate. |
| More → Admin accounts | Admin list, admin detail with approval stats, invite a new admin through the existing invitation workflow, and pending invitations. |
| More → Audit logs | Read-only activity trail with search, module/action/user/date filters and a per-entry detail view. |
| More → Inventory | Read-only stock overview with low-stock and out-of-stock filters. |
| More → Notifications | In-app notification centre: unread badge, mark one/all as read, tap to open the related record. |
| More → Profile / Settings | Account, effective permissions, and phone notification controls. |

## Notifications

Laravel decides when a notification exists — the phone never decides that an order was paid.

```
Order/product/account event in Laravel
  → SuperAdminNotifier stores a database notification per active Super Admin
  → MobilePushOutbox queues one delivery per registered device
  → `php artisan mobile:send-push` (scheduled every 10s) sends it over FCM HTTP v1
  → tapping it opens the related screen (and marks it read)
```

Events wired today: new online order, order paid / shipped / completed / cancelled, admin approval
submitted, admin invitation accepted, account suspended/reactivated, stock crossing into low or
out-of-stock, and repeated failed logins. Alert copy never contains customer names or addresses because
it also appears on lock screens.

Refunds are alerted when they complete or fail, and a burst of same-kind alerts that has not been sent
yet (a batch of admin submissions, a run of new orders) is folded into one summary such as
"4 changes awaiting approval" that opens the queue. Every individual event still lands in the in-app
notification centre.

Signing in registers the phone: the app asks for notification permission once per install, registers
with FCM and hands the token to Laravel bound to that session. Turning alerts off in Settings is
respected on later sign-ins - see `FIREBASE_SETUP.md`.

## API surface used by the app

All routes require the Super Admin bearer token.

- `POST /api/login`, `POST /api/logout`, `GET /api/me`
- `GET /api/dashboard`
- `GET /api/orders`, `GET /api/orders/counts`, `GET /api/orders/{id}` *(read only)*
- `GET /api/approvals`, `GET /api/approvals/counts`, `GET /api/approvals/{id}`, `POST /api/approvals/review`
- `GET /api/users`, `GET /api/users/counts`, `GET /api/users/{id}`, `PATCH /api/users/{id}/status`
- `GET /api/admins/{id}`, `GET /api/admin-invitations`, `POST /api/admin-invitations`
- `GET /api/inventory`
- `GET /api/activity-logs`, `GET /api/activity-logs/filters`, `GET /api/activity-logs/{id}`
- `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`
- `GET /api/push/status`, `PUT /api/push/device`, `DELETE /api/push/device`, `POST /api/push/test`

## Run locally

1. `npm install`
2. Set `VITE_API_BASE_URL` in `.env.local` to the Laravel address **including** `/api` (default is the
   deployed site). Never use `localhost` for a physical phone.
3. `npm run dev`

The backend must be deployed with the new routes and migrations before the app can talk to that host.

## Android build

Application ID: `io.ionic.starter` (unchanged so the existing Firebase Android client and installed app
keep working). Display name: `Achilles Super Admin`.

1. `npm run android:sync`
2. `npm run android:open`, or `./gradlew.bat assembleDebug` in `android/`
3. Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## Checks

- `npm run build` (vue-tsc + vite)
- `npm run lint`
- `npx vitest run`
- Start Vite, then `npm run test:e2e` (every API call is mocked; no live records are touched)
- Backend: `php artisan test` and `php vendor/bin/phpunit -c phpunit-governance.xml` in `../caps`

## Performance model

The API lives on a remote host, so every round trip costs real time. The app is built so a
screen never waits for one:

- **Stale-while-revalidate.** Each list (orders, approvals, customers, admins, invitations,
  inventory, logs, notifications) and the dashboard keep their last payload and repaint it
  immediately, then revalidate in the background. A failed refresh keeps the data on screen with a
  "couldn't refresh" notice and a retry, and the payload that is on screen is never cleared.
- **Two-layer cache.** `src/services/screen-cache.ts` keeps entries in memory for the session and
  mirrors them into Capacitor Preferences, so even a cold start paints the last snapshot instead of
  a full skeleton. Entries are filed per signed-in account, cleared on sign-out, and capped in size
  and count.
- **No duplicate work.** Identical GETs that overlap share one request
  (`src/services/api.ts`), each screen has a single owner of its data (`usePaginated`), and an
  `app-resumed` event only re-fetches screens whose data has aged past the cache window.
- **Cancellation.** Changing filters, searching or leaving a screen aborts the request it replaces
  and drops any response that arrives too late to matter.

### Seeing what a screen costs

Development builds only: open the console (`npm run dev`) and use

```
__achillesPerf.report()    // requests, reused, failures and time per screen
__achillesPerf.entries     // every raw sample: endpoint, status, duration
__achillesPerf.reset()     // start a clean measurement
```

Each navigation prints a one-line summary of the screen you left, and every request logs its
endpoint and duration. Nothing is recorded in production builds.

## Design

Light, premium palette built for mobile: Inter, red `#dc2626` / deep red `#991b1b` accents on black,
white and slate neutrals, dark hero headers, bottom tab navigation, skeleton loading, empty and error
states, pull-to-refresh, infinite scroll, confirmation dialogs for sensitive actions and toast
feedback. Tokens live in `src/theme/variables.css`.
