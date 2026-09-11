# Installation

## Try it without installing anything else

```bash
npm install          # fetches dependencies
npm run dev          # then open http://localhost:5173
```

Pick the **Simulation (sans micro)** engine: it replays your text with the
errors of a real reading. It is the fastest way to see whether the tool suits
you.

## The speech engine

Real voice tracking needs a recognition engine.

### Vosk — recommended

It runs **entirely on your device**: free, no key, no account, and no network
once the model is downloaded. It is the only one that works in the desktop app.

```bash
npm run model
```

The French model is around fifty megabytes and downloads once. The command
places it correctly whatever directory you run it from, and re-downloads
nothing if it is already there.

Models for other languages are listed at
[alphacephei.com/vosk/models](https://alphacephei.com/vosk/models). Note that
the text normalisation and the phonetic matching in this project are written
for French; another language will track less well until they are adapted.

### Web Speech — fallback

The browser's own engine, available in Chrome with nothing to install. Handy
for a quick try, but it sends audio to Google's servers and **does not work in
the desktop app**: the browser bundled inside Electron has no key for the
service. The app hides it in that context rather than letting you pick an
engine that would fail silently.

## Desktop — macOS, Windows, Linux

```bash
npm run app
```

The app opens in its own window, without a browser. On macOS it asks for
microphone permission at launch rather than when you press **Start**.

### Building a .dmg — macOS

To hand the app to someone who has neither Node nor the repository:

```bash
npm run model        # optional: embeds the speech model in the .dmg
npm run dmg
```

The file lands in `dist/`: `Souffleur-0.1.0-arm64.dmg`. It weighs about
165 MB, 40 MB of which is the speech model when present — the app then works
offline from its very first launch, with nothing left to download.

The build targets Apple Silicon Macs. For an Intel Mac, replace `arm64` with
`x64` in the `build.mac.target` field of `package.json`, or use
`["arm64", "x64"]` to ship both in one file.

### Windows and Linux

```bash
npm run windows      # dist/Souffleur Setup 0.1.0.exe — a regular installer
npm run linux        # dist/Souffleur-0.1.0.AppImage — x64 and arm64
```

Both are built **from the Mac**, with no Windows or Linux machine involved.

The AppImage is not installed: it is a single file to make executable
(`chmod +x`) and run. It works on every recent distribution, which saves
maintaining one package per family.

The `.deb` was set aside: its tooling (`fpm`) refuses to download behind some
corporate networks. It can still be built from a Linux machine, or through
Docker, by adding `"deb"` to the `build.linux` targets in `package.json`.

The Windows installer is unsigned too: SmartScreen will warn on first launch —
**More info → Run anyway**. A Windows signature is rented by the year, like
Apple's.

### What the packaging settles, and what breaks without it

- **The microphone sentence.** macOS requires a written explanation
  (`NSMicrophoneUsageDescription`) before an app may even ask for the
  microphone. Without it the system does not ask the question: it kills the app.
- **The entitlements.** The hardened runtime forbids just-in-time compilation
  and unsigned executable memory by default — both of which the JavaScript
  engine and the WebAssembly speech engine need. They are declared in
  `build/entitlements.mac.plist`.
- **Files left readable.** Electron's `asar` archive is disabled: the speech
  model and the WebAssembly binary are loaded by the page with `fetch`,
  exactly as in development.
- **`node_modules` excluded.** The app is pure web and reads no npm file at
  runtime; only `vendor/` ships.

### On first launch, macOS will refuse

The app is not signed by an Apple developer account: it carries an ad-hoc
signature, enough for it to run, not enough for macOS to open it on a
double-click after a download. The message says the app is "damaged" or comes
from "an unidentified developer" — it is misleading: the file is fine.

Two ways through:

- **Right-click → Open**, then *Open* in the dialog. Once per person, per
  machine.
- Or, if the message persists, in the Terminal:

```bash
xattr -dr com.apple.quarantine /Applications/Souffleur.app
```

Making that warning go away for good takes an Apple developer account at $99 a
year, plus signing and notarisation on every release. It is the same cost that
ruled out iOS.

## Android

```bash
npm install
npm run android      # builds the app and opens Android Studio
```

In Android Studio: plug the phone in over USB (with USB debugging enabled),
select the device at the top of the window, press **Run**. Allow about fifteen
minutes the first time — Android Studio downloads the SDK and Gradle.

### Why Android Studio is required

Electron is a browser plus Node.js packaged for a computer: there is no Android
version. Android needs a different wrapper, and that is **Capacitor** — it
installs the exact same web app inside an Android application.

```
        the core, written once
        (index.html, src/, vendor/)
                    │
        ┌───────────┴───────────┐
    Electron                Capacitor
   macOS · Windows           Android
```

Nothing is written twice. Building an Android app requires Google's SDK, and
Android Studio is the official tool that provides it.

### What is already set up in the Android project

Three things, two of which break the app if forgotten:

- **Microphone permission.** Capacitor's template only declares internet
  access. Without `RECORD_AUDIO`, the WebView refuses the microphone with no
  usable error — it looks like a bug in the speech engine when it is a missing
  line in the manifest.
- **Keeping the screen awake.** A teleprompter whose screen goes dark mid-speech
  is useless. The app takes a screen wake lock while reading and releases it on
  stop, reacquiring it when returning from the background — the system does not
  do that by itself.
- **Microphone declared optional at install time.** Without a microphone the app
  is still usable with manual scrolling: no reason to exclude a device.

### Check whether the speech engine fits on your phone

The French model takes memory inside the WebView. On a tight device, Android
may kill the app while it loads. It is binary: it either fits or it does not.

This can be checked **without Android Studio and without building anything**,
in five minutes.

**1. On the computer**, from the project directory, fetch the model:

```bash
npm run model
```

**2. Start the server over HTTPS** — and this matters:

```bash
npm run dev:https
```

It prints the address to open from the phone. HTTPS is not a refinement: a
browser only grants microphone access in a "secure context". `localhost` is
one, `http://192.168.x.x` is not. Over plain HTTP the phone would display the
page but refuse the microphone, making the test impossible.

**3. On the phone**, connected to the same network, open the printed address:

```
https://<computer-local-address>:5173/tools/android-check.html
```

The certificate is self-signed, so Chrome will warn you. Tap **Advanced →
Proceed to the site**. Once only.

**4. Run the five steps** in order, allowing the microphone when asked. The last
one has you read a sentence aloud — read it at speaking pace, no faster.

The harness measures the device, the WebAssembly engine, the microphone and the
model load, then returns a verdict and a report you can copy. It also detects
the case where the tab is killed for lack of memory: it drops a marker before
the risky step and reads it back on the next start — a page that does not come
back is an answer, not a failure.

**What the verdict means**:

- **green** — Vosk fits on this device. The local engine stays the default on
  Android, and the app works with no network.
- **amber** — it works but tracking drifts. Retry in a quiet room, microphone
  close to the mouth, before concluding.
- **red** — the device cannot take it. Android will need a remote recognition
  engine.

If the verdict is negative, the app can switch to a remote recognition engine:
engine selection goes through a single interface, designed for this from the
start.

## Sharing the app with friends

**As an APK file.** In Android Studio: *Build → Build Bundle(s)/APK(s) → Build
APK(s)*. You get a file to send by message or link. Your friends will have to
allow installation from an unknown source — Android offers this when they open
the file. Free, immediate, no account needed.

**Through the Play Store, as an internal test.** Google developer account at
**$25, paid once** (not to be confused with Apple's **$99 per year** for iOS,
which is why iOS was set aside). One-click installation, automatic updates, and
— the point that matters — **nothing published to the public**: the internal
testing track ships the app to a list of addresses you choose, a hundred at
most. See the next section.

## Publishing privately on the Play Store — internal testing

This is the path meant for a team-only release. The app appears nowhere in the
store: only the people you enrol can install it, through a link.

### 1. The developer account — allow a few days

Create it at [play.google.com/console](https://play.google.com/console): $25,
once. Google verifies your identity (ID, address; a D-U-N-S number if you
register as a company). **That verification is the long pole** — hours to days.
Nothing else can move until it clears, so start it first.

One useful nuance: recent personal accounts must gather twelve testers over
fourteen days **before publishing publicly**. Internal testing is exempt. All
the more reason to stay on that track while the tool stays inside the team.

### 2. The signing key — never lose it

In Android Studio: *Build → Generate Signed App Bundle / APK → Android App
Bundle → Create new…*. You choose a `.jks` file and two passwords.

**Back that file and those passwords up somewhere other than your machine.** An
Android app is identified by its key: lose it and no update is possible ever
again — you would have to republish under another name. Accept **Play App
Signing** along the way, which keeps a copy of the key safe at Google.

What comes out is an `.aab` — what the Play Store expects, where the APK stays
reserved for hand-to-hand delivery.

### 3. Create the app in the console

*Create app*, filling in the name, the language, "App" and "Free". The package
name is already fixed by the project — `fr.souffleur.app` — and **it is
final**: it can never change after the first upload.

### 4. The mandatory declarations

The console publishes nothing until the *App content* section is complete. For
Souffleur:

- **Privacy policy** — a web address is required as soon as an app asks for the
  microphone. A public page is enough; it should say what the project already
  says: audio is analysed on the device and sent nowhere.
- **Data safety** — declare that no data is collected or shared. That is
  accurate with the Vosk engine, which works offline. It would stop being
  accurate with a remote speech engine: this form would then need correcting.
- **Content rating**, **target audience**, **ads** (none), **app access**
  (nothing is restricted).

### 5. Upload and invite

*Testing → Internal testing → Create new release*, drop in the `.aab`, then
under *Testers* create a list with your developers' Gmail addresses. Roll out
the release.

The console then shows a **join link**. Each person opens it, accepts being a
tester, and the app installs from the Play Store like any other. Allow a few
minutes of processing — not the days of review a public release takes.

For the next version, raise `versionCode` in `android/app/build.gradle`
(Google rejects two uploads carrying the same number), rebuild, re-upload: the
update reaches the phones on its own.

### Faster still: internal app sharing

If all you want is to let someone try a work-in-progress build, the console
offers *Internal app sharing*: you drop in an `.aab` or an `.apk` and get a
link, nobody needs to be on a list, and there is no review at all. The link
expires, it brings no automatic updates, and the tester must have enabled
internal app sharing in their Play Store app. It is the APK-by-message
equivalent, with one-click installation on top.

## iOS

Set aside for now: Apple requires a developer account at $99 per year and an
App Store review. The architecture does not rule it out — Capacitor supports
iOS from the same core — it is a cost decision, not a technical limit.

## Security

Since the app is meant to be shared, here is what is locked down:

- **No secrets in the repository.** Any API keys are entered by each user and
  stored on their own device.
- **No hidden network calls.** The speech engine and the typeface are served
  from the app itself; they were verified to contact no server.
- **Desktop window hardened.** Context isolation on, Node integration off,
  sandbox enabled, no preload bridge exposed to the page, external navigation
  refused — a link opens in the system browser, never inside the app.
- **Displayed text is escaped.** A speech pasted from any source cannot execute
  code inside the app.
- **Dependencies are audited.** `npm audit` reports nothing. An earlier alert on
  `uuid` was analysed rather than blindly patched: it concerns the `v3`, `v5`
  and `v6` functions when a buffer is passed to them, and the file actually
  shipped contains none of those, calling only `v4` without a buffer. It was
  not exploitable; the version was raised anyway and build tooling was
  separated from runtime dependencies.
