# Distributing the app

Two audiences, two paths: a `.dmg` file for Macs, and the Play Store's internal
testing track for Android.

---

# macOS — the .dmg file

## Building

```bash
npm install
npm run model      # so the speech model is bundled
npm run dist:mac
```

The file appears in `release/`, named `Souffleur-<version>.dmg`.

Running `npm run model` before building is optional but strongly advised: the
speech model is then **included inside the app**. Your friends download a single
file and recognition works immediately, offline, with no setup. Without it they
only get simulation mode.

The package weighs around 250 MB: the price of a bundled browser, a universal
binary (Intel and Apple Silicon) and the speech model.

## The Gatekeeper problem, and its fix

The app is **not signed with an Apple certificate**. An Apple developer
certificate costs $99 per year — the same one set aside for iOS.

As a result, on first launch macOS will refuse to open the app, with a message
about an unidentified developer or a damaged file. This is not a fault in the
app; it is how macOS treats unsigned software.

**What your friends should do:**

1. Open the `.dmg`, drag Souffleur into **Applications**.
2. Double-click the app. macOS refuses. This is expected.
3. Go to **System Settings → Privacy & Security**, scroll to the message about
   Souffleur, and click **Open Anyway**.
4. Confirm. The refusal will not happen again.

If macOS calls the file "damaged", that is the quarantine attribute placed on
downloaded files. One command removes it:

```bash
xattr -dr com.apple.quarantine /Applications/Souffleur.app
```

**Warn them in advance.** An unexpected error on first launch is enough to make
someone give up who was doing you a favour by trying your tool.

---

## The APK without installing anything

Building an Android app requires Google's SDK and several gigabytes of tooling.
You can skip all of it: **GitHub builds the APK on every push**.

The repository's **Actions** tab → the latest "APK Android" run → the
**Artifacts** section at the bottom → download the archive, which contains the
APK.

It is signed with Android's debug key: installable directly on a phone, but not
publishable to the Play Store. The speech model is bundled by default, so the
app works offline from the moment it is installed.

On the phone, open the file: Android will offer to allow installation from this
source. That is normal for an app that does not come from the Play Store.

---

# Android — Play Store internal testing

This is the most comfortable path for the people close to you: they install from
the Play Store like any other app, and get updates automatically. The app stays
**invisible to the public**: only the people you invite can see it.

## 1. The developer account

[play.google.com/console](https://play.google.com/console) — **$25, once**, for
life. Identity verification is required; allow a few days before the account is
fully active. Start here, it is the longest part.

## 2. The signing key

Once, and **keep it safe**: losing it means never being able to publish an
update to this app again.

```bash
keytool -genkey -v -keystore souffleur-upload.jks \
  -alias souffleur -keyalg RSA -keysize 2048 -validity 10000
```

Then, at the project root:

```bash
cp keystore.properties.example keystore.properties
```

Fill in the passwords you chose. That file and the key are excluded from the
repository: a publishing key is never committed.

Back the key up somewhere other than your disk — a password manager, an
encrypted drive. This is not a precaution, it is the only copy that exists.

## 3. Build the bundle

```bash
npm run build
npx cap sync android
node scripts/android-manifest.js
cd android && ./gradlew bundleRelease
```

The file lands in
`android/app/build/outputs/bundle/release/app-release.aab`.

The Play Store wants an `.aab` (Android App Bundle), not an `.apk`: it builds
the right apk for each phone itself.

## 4. Create the app in the console

**Create app**, then fill in the name, the language, and state that it is a free
app.

## 5. The mandatory declarations

This is the step nobody anticipates, and it is required **even for internal
testing**. Under **App content**:

- **Privacy policy** — a public web address is **mandatory**, because the app
  requests the microphone. The text is already written:
  [privacy.md](privacy.md). Publish it, for instance with GitHub Pages
  (*Settings → Pages*), and give its address.
- **Data safety** — declare that no data is collected or shared. That is
  accurate: audio is processed on the device and texts never leave the phone.
- **Content rating** — a questionnaire, a few minutes.
- **Target audience** — adults, productivity app.
- **Ads** — none.

## 6. The internal testing track

**Testing → Internal testing → Create new release**, upload the `.aab`.

Then **Testers**: create a list and add your friends' email addresses, up to 100
people. They must use the address tied to the Google account on their phone.

Finally, copy the **opt-in link** and send it to them.

## 7. What your friends do

1. Open the link they received and accept becoming a tester.
2. Follow the "download it on Google Play" link that then appears.
3. Install normally.

No obscure steps, no unknown sources to allow, and updates arrive by themselves.

## Worth knowing

- Internal testing **waits for no review**: a release is available within
  minutes. That is what sets it apart from closed or open testing.
- Every new release needs a **higher version number** (`versionCode` in
  `android/app/build.gradle`).
- The account's first submission may require extra verification. Plan for it.

---

# Comparing the paths

| | .dmg (macOS) | Direct APK | Play internal testing |
|---|---|---|---|
| Cost | free | free | $25 once |
| For your friends | a warning to bypass | unknown source to allow | normal install |
| Updates | resend by hand | resend by hand | automatic |
| Time to publish | immediate | immediate | a few minutes |
| Declarations | none | none | privacy policy and forms |
