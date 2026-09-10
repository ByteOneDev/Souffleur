# Documentation — Prompteur

A teleprompter that follows your voice through your own text: the current word
lights up, the text scrolls by itself, and the timer tells you continuously
whether you are ahead of or behind schedule.

## Contents

1. **[User guide](guide.md)** — writing a script, annotating it, reading it on
   stage. Start here.
2. **[Installation](installation.md)** — desktop, Android, and how to share the
   app with friends.
3. **[How it works](how-it-works.md)** — voice tracking explained, the
   measurements, the speech engines and their limits.

## In thirty seconds

```bash
npm install
npm run dev      # then open http://localhost:5173
```

Pick the **Simulation** engine to see the teleprompter work without a
microphone: it replays your own text with the errors of a real reading.

## What it does

- **Follows your voice** through the text and lights up the current word.
- **Scrolls** at your pace, not at an imposed one.
- **Catches up** when you skip a paragraph, repeat a sentence, or improvise an
  aside.
- **Times you**: elapsed, estimated remaining, and how far ahead or behind you
  are against your target duration.
- **Annotates** the text: stressed words, passages not to miss, timed pauses,
  and stage directions that are never spoken.
- **Locks** the text so a stray keystroke cannot alter it.
- **Keeps the screen awake** for the whole reading.

## What it does not do

- It does not read for you: there is no speech synthesis.
- It does not rewrite your text on its own.
- It does not listen behind your back: recognition only runs when you press
  **Start**, and the default engine never leaves your device.

*(French documentation: [doc/francais](../francais/).)*
