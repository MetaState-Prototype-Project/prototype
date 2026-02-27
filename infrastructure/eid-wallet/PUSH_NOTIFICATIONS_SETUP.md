# Push Notifications Setup (Android & iOS)

The eid-wallet uses [tauri-plugin-notifications](https://github.com/Choochmeque/tauri-plugin-notifications) for push notifications on Android (FCM) and iOS (APNs).

## Android (Firebase Cloud Messaging)

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/).

2. **Add an Android app** to your Firebase project with package name `foundation.metastate.eid_wallet`.

3. **Download `google-services.json`** from Firebase Console and place it in:
   ```
   src-tauri/gen/android/app/google-services.json
   ```

4. **Note:** The Google Services classpath and plugin have been added to the Android build. If you regenerate the `gen/` folder (e.g., after `tauri android init`), re-apply these changes to:
   - `gen/android/build.gradle.kts`: Add `classpath("com.google.gms:google-services:4.4.2")` to buildscript dependencies
   - `gen/android/app/build.gradle.kts`: Add `apply(plugin = "com.google.gms.google-services")` at the bottom

## iOS (Apple Push Notification service)

1. **Add Push Notifications capability** in Xcode:
   - Open `src-tauri/gen/apple/eid-wallet.xcodeproj` in Xcode
   - Select the iOS target → Signing & Capabilities
   - Click "+ Capability" and add "Push Notifications"

2. The `aps-environment` entitlement has been added to `eid-wallet_iOS.entitlements` for development. For production builds, update to `<string>production</string>`.

3. **Test on a physical device** — the iOS simulator has limited push notification support.

## Usage

The `NotificationService` automatically:
- Requests permissions via `requestPermissions()`
- Registers for push via `registerForPushNotifications()` on Android/iOS when `registerDevice()` is called
- Sends the FCM/APNs token to your provisioner as `fcmToken` in the device registration payload

Your backend can use this token to send push notifications through Firebase Admin SDK (Android) or your APNs provider (iOS).
