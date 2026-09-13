# Phase 5 mobile optimization checkpoint

Date: 2026-09-13. Parent: `6d55a2a9b5440b453164543af88300896cf19c0a`.

This checkpoint changes only the Achilles mobile repository. It does not deploy, publish or sign an APK, alter Firebase, or change the `io.ionic.starter` application ID.

## Compatibility and bundle

The production target is explicitly `chrome89`. Android API 24 remains the minimum OS API, but a supported installation must provide Android System WebView or Chrome 89 or newer. The Vite legacy plugin and its SystemJS/polyfill copies were removed.

| Measure | Baseline | Phase 5 |
| --- | ---: | ---: |
| Production web build, end to end | 90,690 ms | 16,770 ms |
| Vite build phase | about 62,000 ms | 3,270 ms |
| `dist` bytes | 3,006,057 | 1,499,941 |
| JavaScript files | 107 (53 modern + 54 legacy/polyfill) | 33 |
| Legacy JavaScript bytes | 1,541,195 | 0 |
| JavaScript bytes | 2,911,610 combined | 1,372,122 |
| Largest shared chunk | about 1,114 KB | 1,233,040 bytes raw / about 275,240 bytes gzip |

The largest shared file contains the Ionic runtime registered by `IonicVue`. Route pages remain dynamic imports and produce separate chunks. Dependency grouping separates Capacitor from Ionic instead of creating a generic vendor bundle.

Inter weight range 400-800 is packaged as one 48,432-byte variable WOFF2 file under the SIL Open Font License. The WebView no longer contacts Google Fonts.

## Startup and session

The lightweight application shell mounts before native storage restoration. Legacy screen-cache deletion runs in the background and never reads old payloads. Screen data remains bounded to 40 memory-only, account-scoped entries and is cleared at logout.

Authentication restoration is shared for the process. The secure storage test records two native reads on startup, one each for token and profile, then zero additional native reads for later route guards and API requests. Concurrent reads stay deduplicated, logout stays serialized against restoration, and invalid/unavailable encrypted state clears local authentication. Browser authentication remains memory-only.

These are code and test measurements. No physical-device startup timing was fabricated.

## Network policy

Defaults in `.env.example` are:

- normal timeout: 8 seconds;
- GET retry count: one;
- retry backoff: 350 ms;
- maximum honored automatic `Retry-After`: 5 seconds;
- exceptional bulk-approval timeout: 20 seconds.

Only GET requests retry automatically. Overlapping identical authenticated GETs share the same promise and include the session generation in their key. Offline, timeout, rate-limit, cold-backend, cancellation, authentication and malformed-response failures are classified separately. `401` and `403` never retry. Writes, including orders, approvals, invitations, account changes, notifications and push registration, never retry automatically. Caller cancellation also cancels retry waits.

## Content Security Policy and origins

Production uses a generated meta CSP with:

- `script-src 'self'`, with no `unsafe-eval` or inline script permission;
- nonce-bound Ionic style elements and `style-src-attr 'none'`;
- packaged fonts;
- images from the app, data/blob URLs and the configured Laravel API origin;
- connections only to the app and configured HTTPS Laravel API;
- no objects, frames or form submissions;
- insecure-request upgrading.

Production builds fail if `VITE_API_BASE_URL` is not HTTPS. Development additionally permits HTTP on `localhost`, `127.0.0.1` and the Android emulator alias `10.0.2.2`, with local HMR WebSockets. Android cleartext is disabled in the main/release manifest and enabled only by the debug manifest overlay.

A local Chrome runtime probe confirmed CSSOM `style.setProperty` updates still apply with `style-src-attr 'none'`. The built Ionic runtime reads `meta[name="csp-nonce"]`, and the production HTML supplies the matching nonce. Full component behavior still needs the device checklist below.

The only production WebView resource/connection origin is the configured Laravel origin (currently `https://achilleswearyourweakness.shop`). FCM traffic is native and outside WebView CSP. The authenticated Laravel API supplies approval-image and order-map navigation URLs. CSP does not constrain top-level navigation, so their production scheme and host allowlist remain a server/device QA item.

## Android release

Release builds use `proguard-android-optimize.txt`, R8 minification, resource shrinking and explicit `debuggable false`. The local `SecureSessionPlugin` has the only project keep rule because `MainActivity` registers it for bridge reflection. R8 mapping confirms both SecureSession and Push Notifications classes remain. The merged release manifest has `usesCleartextTraffic=false`, retains the push messaging service and retains `allowBackup=false`.

| APK | Bytes |
| --- | ---: |
| Baseline fresh unsigned release | 5,516,669 |
| Phase 5 debug | 6,942,136 |
| Phase 5 unsigned release | 1,959,102 |

The unsigned release is 3,557,567 bytes (64.5%) smaller than baseline. It was built for verification only and was not copied, signed or published.

The combined `test lint assembleDebug assembleRelease` run took 1,246,185 ms in this environment. That timing is not comparable to the baseline: Android Studio's bundled JBR had changed to Java 25 and was incompatible with Gradle 8.14.3, so verification used a newly downloaded temporary Temurin JDK 21 and ran lint across all modules. Use an installed JDK 21 for repeatable builds.

## Removed dependencies and generated files

Removed runtime dependencies: `firebase`, `@capacitor-firebase/messaging`, `@capacitor/haptics`, `@capacitor/keyboard`, and `@capacitor/status-bar`. The legacy Vite plugin and its Terser dependency were also removed. Capacitor sync now registers App, Preferences and Push Notifications; the Keystore plugin remains directly registered by `MainActivity`.

Cleanup removed tracked Android Studio metadata, release output metadata, generated baseline-profile output, default Android template tests, the unused Cypress example fixture, the personal VS Code recommendation and the unreferenced `achilles_logo*` resource family. Each removed logo bitmap/background had a byte-identical active `ic_launcher*` counterpart. Ignore rules prevent generated metadata and release exports from returning.

## Verification and remaining QA

Automated verification completed:

- Vitest: 67 passed;
- ESLint: passed;
- TypeScript and production Vite build: passed;
- no-legacy/CSP/local-font build verifier: passed;
- runtime-only npm audit: 0 vulnerabilities;
- full npm audit: 13 development-tool advisories (5 moderate, 8 high);
- Capacitor sync: passed, three packaged Capacitor plugins;
- Gradle test: passed (no native unit-test sources after template cleanup);
- Android lint: passed;
- debug assembly: passed;
- R8/resource-shrunk unsigned release assembly: passed.

The Vite build retains Ionic's existing `:host-context` CSS minifier warnings and the large Ionic shared-chunk warning. Gradle retains the generated flat-directory and Gradle-9 deprecation warnings. Full npm audit issues remain in Cypress, ESLint and Capacitor CLI dependency trees; clearing all of them currently requires breaking upgrades. Cypress 13.17.0 still cannot start on this machine because its executable rejects the required --smoke-test and --ping flags. A forced reinstall of the same pinned binary completed but produced the identical error, so no Cypress E2E claim is made.

Before release, test on a physical Android device and supported WebView:

1. cold start, process-death restoration, logout during restoration and invalidated Keystore key;
2. login, every tab, guarded/deep-linked routes and back navigation;
3. loaders, alerts, modals, action sheets, toasts, refreshers, transitions and keyboard interaction under CSP;
4. cached, empty, offline, timeout, rate-limit and cold-backend states;
5. approval images, order map links and all API-loaded images;
6. notification permission, initial and rotated FCM token registration, foreground/background receipt, notification tap routing and logout cleanup;
7. app upgrade from a build containing legacy plaintext Preferences and screen snapshots;
8. visual comparison of local Inter rendering at all used weights.

The Firebase project still targets the unchanged `io.ionic.starter` identity. Obtaining/registering the intended Firebase Android client and then changing the application ID remains a release blocker. No device or emulator was connected for this checkpoint.
