# Privacy Policy — Souffleur

*Last updated: 10 September 2026*

## In one sentence

Souffleur collects no personal data, has no account and no server, and your
voice never leaves your device.

## What the app does with your voice

Souffleur listens to the microphone while you read, only when you press
**Start**, and only to locate your position in the text you gave it.

By default, speech recognition runs **entirely on your device**, using the Vosk
engine and a model downloaded once. No recording is kept: audio is analysed as
it arrives and then discarded. Nothing is transmitted, to anyone.

**One exception, which you choose explicitly.** The app offers a fallback engine
called "Navigateur (Web Speech)". If — and only if — you select it, recognition
is performed by the browser, which means audio is sent to its vendor's servers
under their terms, not ours. The local engine remains the default.

## What the app does with your texts

Your speeches are saved in the app's local storage, on your device. They are not
synchronised, not backed up online, and never sent to us. Uninstalling the app
or clearing its data deletes them permanently.

## What the app does not do

- No account, no sign-up, no identification.
- No analytics, no trackers, no advertising.
- No sharing with third parties, since there is nothing to share.
- No collection of location, contacts or identifiers.

## Network connections

The app reaches the network in two cases only:

1. **Downloading the speech model**, once, from `alphacephei.com`. No personal
   data accompanies that request.
2. **Writing-assistance features**, if you add one by supplying your own API
   key. The text you submit is then sent to the provider you chose, under their
   terms. Your key is stored on your device and never reaches us.

Outside these two cases, the app works offline.

## Permissions requested

| Permission | Why |
|---|---|
| Microphone | to follow your voice through the text, while reading only |
| Internet | to download the speech model once |

The microphone permission is optional: without it, the app remains usable with
manual scrolling.

## Children

The app is not directed at children in particular, and collects no data
whatever the age of the person using it.

## Changes

Any change to this policy will be published on this page, with its date.

## Contact

For any question about this policy, open an issue on the project's public
repository.
