# iOS and Android release

The native operator app is one Expo codebase targeting iOS and Android. The checked-in baseline is Expo SDK 57 / React Native 0.86 with Expo Router and Expo SecureStore.

## Configure identifiers and environment

`apps/mobile/app.config.ts` reads `IOS_BUNDLE_ID`, `ANDROID_PACKAGE` and `EAS_PROJECT_ID`; defaults use `media.spheric.agents`. Set the final immutable store identifiers before the first production submission. In EAS production environment variables set `EXPO_PUBLIC_API_URL=https://agents-api.spheric.media` (or your final API host). Never place social provider secrets in `EXPO_PUBLIC_*` variables.

Create the EAS project, Apple App Store Connect application and Google Play application; configure signing credentials through EAS or your approved signing process. The current app requests no contacts/location/camera permissions and does not ship ad tracking.

## Validate

From the repo root in a network-connected environment:

```bash
npm ci
npm run typecheck -w @spheric/mobile
npx expo-doctor apps/mobile
npm run start -w @spheric/mobile
```

Test login/refresh/logout, offline logout, approval actions, campaign generation, account posting kill switches, expired sessions and API error rendering on physical iOS and Android devices.

## Build and submit

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
npx eas-cli submit --platform ios --profile production
npx eas-cli submit --platform android --profile production
```

Use internal/TestFlight tracks first, then staged/phased rollout. Complete Apple privacy nutrition labels and Google Play Data Safety based on the **actual** production telemetry stack. If Sentry, push notifications, photos/media pickers, device identifiers or other SDKs are added later, update native permissions and store disclosures.

## Mobile security posture

Mobile intentionally does not accept raw social-provider credentials; connection/credential rotation remains an admin web/API operation. This reduces high-value credential exposure on operator devices. SecureStore holds only Spheric session tokens. Server-side RBAC remains authoritative regardless of what controls are shown in the app.
