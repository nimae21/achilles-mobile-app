# Enable Achilles Super Admin phone notifications

Reference guide for maintaining the Firebase integration. The developer has completed setup and
installed the app; use these steps when changing environments or checking delivery after an update.

## 1. Create the Firebase project and Android app

1. Open https://console.firebase.google.com/ and create a project for Achilles. Google Analytics is
   optional for these alerts.
2. Add an **Android app** whose package name matches `applicationId` in
   `android/app/build.gradle` — currently **io.ionic.starter**. It must match exactly.
3. Download the Android client **google-services.json**.
4. Place it at **android/app/google-services.json** in this mobile project.
5. Note the Firebase **project ID** (not the project display name).

The client file is ignored by Git. Do not replace it with a service-account file.

Official guide: https://firebase.google.com/docs/cloud-messaging/android/client

## 2. Configure the Laravel website

The server sends FCM HTTP v1 messages using Google's PHP authentication library.

1. Deploy the backend changes from the local `caps` project, including `composer.lock`, the migrations,
   models, observers, `SuperAdminNotifier`/`MobilePushOutbox`, routes and the command.
2. Run `composer install --no-dev --optimize-autoloader`.
3. Keep `MOBILE_PUSH_ENABLED=false` while running `php artisan migrate --force`.
4. In Firebase Project Settings → Service accounts, generate a service-account key. Store that server
   JSON outside the public directory, for example `storage/app/firebase/service-account.json`.
   Restrict file access to the server account.
5. Set the server environment:

```dotenv
# Railway / containers: the entire service-account JSON in one variable.
MOBILE_PUSH_ENABLED=true
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id","private_key_id":"...","client_email":"...","private_key":"...the value Firebase exported, with its \n escapes intact..."}
# Optional: leave empty to use the project id inside the key.
FIREBASE_PROJECT_ID=

# Local development alternative, used only while the variable above is empty:
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/server/path/storage/app/firebase/service-account.json
```

6. Run `php artisan config:cache` after setting the environment.
7. Ensure the Firebase Cloud Messaging API (HTTP v1) is enabled for the project.

**Never put the service-account JSON in the mobile project, public directory, or Git. Never paste its
private key into chat.** The backend `storage/app/firebase/` directory is ignored by Git.

The backend accepts either source, preferring the variable: `FIREBASE_SERVICE_ACCOUNT_JSON` is decoded
in memory and handed straight to Google's client, so no temporary key file is ever written. Only when
that variable is empty does `GOOGLE_APPLICATION_CREDENTIALS` name a file to read, which keeps local
development working unchanged. Keep `FIREBASE_PROJECT_ID` set to the project you intend to notify, or
leave it empty to use the `project_id` inside the key.

`php artisan config:cache` must be re-run after changing any of these variables; a container that reads
its configuration from the cache keeps serving the old value until it is rebuilt. With
`MOBILE_PUSH_ENABLED=true` and a missing or malformed key, the sender refuses to send and
`php artisan mobile:send-push` prints the variable to fix (for example
"FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON."). Those messages name variables only - credential
contents never appear in console output, delivery records, exceptions or API responses.

Official authentication guide: https://firebase.google.com/docs/cloud-messaging/send/v1-api

## 3. Run the notification sender

The background sender runs every ten seconds through Laravel's scheduler; no separate queue worker is
required. Keep the scheduler running in production (Railway: one process running
`php artisan schedule:work`, or the platform's scheduler equivalent).

## 4. What the phone receives

Notifications are created by Laravel when something happens on the website — the app never decides
that an order was paid:

- new online order, and order paid / shipped / completed / cancelled
- admin approval submitted, admin invitation accepted
- account suspended or reactivated
- stock crossing into low stock or out of stock
- repeated failed logins (security alert)

Each alert carries a validated in-app `route`, so tapping it opens the related order, approval, account,
log or inventory screen and marks the matching in-app notification as read.

## 5. Notification integration notes

The app uses `@capacitor/push-notifications` for its native callbacks. The app manifest removes the
competing FCM service from `@capacitor-firebase/messaging`, while leaving that installed dependency
intact. If migrating notification APIs later, update both the service selection and the JavaScript
listeners together.

Token rotation refreshes the server registration. Logout cleanup finishes before another login can
register the phone. Retry attempts cannot be cancelled by a late failure from an earlier attempt, and a
delayed 401 from an old login cannot erase a newer session.

## 6. Registration on sign-in

The phone registers itself as part of signing in, which is what makes alerts work while the app is
closed:

1. The Super Admin signs in successfully.
2. The app asks for notification permission - once per install, and only when the phone has never
   been asked and the Super Admin has never turned alerts off.
3. The phone registers with FCM and receives its token.
4. The token is sent to Laravel with the installation id and bound to the signed-in session.

A phone where alerts were turned off in Settings stays off; the Super Admin re-enables them from
More -> Settings. Declining the Android prompt also leaves the app usable - the Settings screen
explains how to allow notifications later, and the next sign-in picks the permission up automatically.

`android/app/src/main/AndroidManifest.xml` declares `POST_NOTIFICATIONS` explicitly. Android 13+
silently drops notifications without it, so it must stay even though the push plugin also declares it.

## 7. Alert volume

Alerts are created for events that need the Super Admin, and never for routine activity:

- new online order, and order paid / shipped / completed / cancelled
- refund completed or failed (money leaving the business)
- admin approval submitted, admin invitation accepted
- account suspended or reactivated
- stock crossing into low stock or out of stock (one alert per variant per level per 12 hours)
- repeated failed logins for one address (one alert per 30 minutes)

When several alerts of the same kind pile up before the sender has run (an admin submitting a batch of
changes, or a burst of orders during a sale), they are folded into one summary - "4 changes awaiting
approval" - that opens the queue instead of a single record. Every individual event still appears in
the in-app notification centre. An alert that has already been sent is never rewritten.
