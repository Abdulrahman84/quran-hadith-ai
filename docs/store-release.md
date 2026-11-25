# Releasing to the App Store and Google Play

The app is `com.sanaddai.app` on both stores (`ai.sanad.app` was already taken on Google Play). The Android Java package stays `ai.sanad.app`. Listing text lives in
`fastlane/metadata` (the layout `fastlane deliver` and `fastlane supply` read),
so it can be pasted into the consoles or uploaded with fastlane later.

## Versions

Bump both before every upload; the stores reject a build number they have seen.

| | Version shown to users | Build number |
| --- | --- | --- |
| iOS | `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` | `CURRENT_PROJECT_VERSION` |
| Android | `versionName` in `android/app/build.gradle` | `versionCode` |

## iOS

1. Add `APPLE_TEAM_ID=<team id>` to `.env.local`. The team ID stays out of the repo.
2. `npm run mobile:release:ios` builds the web bundle, archives with automatic
   signing and exports `release/ios/App.ipa`.
3. Upload the `.ipa` with Xcode Organizer, Transporter, or
   `xcrun altool --upload-app` and an App Store Connect API key.

The app is iPhone only, portrait only. `PrivacyInfo.xcprivacy` declares the
data collected (below) and `ITSAppUsesNonExemptEncryption` is `false`: the app
only uses HTTPS.

## Android

1. Create the upload keystore once, outside the repo, and keep a backup:

   ```bash
   keytool -genkeypair -keystore ~/.sanad-signing/sanad-upload.jks -storetype PKCS12 -alias sanad-upload -keyalg RSA -keysize 4096 -validity 10000
   ```

2. Write `android/keystore.properties` (git-ignored):

   ```properties
   storeFile=/absolute/path/to/sanad-upload.jks
   storePassword=...
   keyAlias=sanad-upload
   keyPassword=...
   ```

3. `npm run mobile:release:android` writes
   `android/app/build/outputs/bundle/release/app-release.aab`.

Play App Signing holds the app signing key; the keystore above is only the
upload key, so Google can reset it if it is lost.

## Store forms

**Privacy policy:** https://sanaddai.com/privacy. **Support:** https://sanaddai.com/support.

**App Store privacy ("App Privacy")**: Data collected: *User Content → Other
User Content* (the question or text the user submits). Not linked to the
user's identity, not used for tracking. Purposes: App Functionality, Analytics.
Nothing else is collected.

**Google Play Data safety**: Collects *App activity → Other user-generated
content*; not shared (OpenRouter processes it as a service provider); processed
ephemerally: no, it is stored in the activity log; required: yes; purposes:
App functionality, Analytics. Encrypted in transit: yes. Deletion request:
users can ask through the support page, though entries are not tied to a user.
No account creation.

**Content rating**: reference app, no user interaction, no ads, no purchases,
no location. It shows religious texts and generates short AI answers from them.

**Category**: Reference (secondary: Education on iOS; Books & Reference on Play).

**Review notes** for Apple are in `fastlane/metadata/ios/review_information/notes.txt`.

## Screenshots

The App Store needs 6.9" iPhone screenshots (1320 × 2868). Play needs at least
two phone screenshots with an aspect ratio no longer than 2:1, a 512 × 512 icon
and a 1024 × 500 feature graphic. Take them from the iOS Simulator with
`xcrun simctl io <device> screenshot`, after setting a clean status bar with
`xcrun simctl status_bar <device> override --time 9:41`.
