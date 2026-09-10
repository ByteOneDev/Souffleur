# User guide

## 1. Choose the kind of speaking

Before writing, choose between **Lecture** (reading) and **Discours** (speech).
This is not a label: the two modes tune the tracking engine differently.

| | Reading | Speech |
|---|---|---|
| Your use | you follow the text word for word | you speak from the text |
| Tracking | precise, low tolerance for deviation | tolerant of improvisation |
| Best at | literary, repetitive, anaphoric texts | jumps, restarts, asides |

In practice: **Reading** for a quotation, an official text, a poem. **Speech**
as soon as you allow yourself to improvise.

You can switch at any time, including mid-preparation.

## 2. Write and annotate the text

Type or paste your text in the left panel. Six annotations are available:

| You write | What it does |
|---|---|
| `**important**` | the word appears in bold: stress it |
| `==do not miss==` | highlighted passage |
| `_nuance_` | italic, for an aside |
| `# Section title` | structural marker — **never spoken** |
| `(2s)` | timed pause — **never spoken** |
| `[[look at the audience]]` | stage direction — **never spoken** |

The last three matter: they appear on screen but are removed from the text the
engine tries to follow. You can write yourself directions without disturbing
the tracking.

### A complete example

```
# Opening

Ladies and gentlemen, good evening. (2s) [[sweep the room with your eyes]]

I would like to begin with something **obvious** that we have collectively
forgotten: technology is ==never neutral==.
```

## 3. Set the target duration

Enter the duration you are aiming for, in minutes. As soon as you start
reading, the **Ahead / behind** indicator compares your actual progress with
the elapsed time:

- **green**: you are on schedule;
- **blue**: you are ahead — you can breathe, expand;
- **red**: you are behind — speed up or cut.

This is the most useful indicator in the tool. It stops you from discovering at
the end that you ran ten minutes over.

## 4. Adjust the display

- **Text size**: raise it generously if the screen is far from you.
- **Fast reading / Typewriter**: the first is a proportional typeface, which
  reads faster at a distance; the second keeps the monospace of the interface.
  Try both, keep whichever tires you less.
- **Mirror mode**: flips the text horizontally, for a physical teleprompter
  with a half-silvered glass.
- **Theme**: the button at the top left cycles through automatic, light and
  dark. In a darkened room, dark tires the eyes less and lights your face less.

## 5. Lock the text

The **🔓 modifiable** button switches to **🔒 locked** (or press `L`). Once
locked, neither the text nor the title can be changed.

Do this every time before going on stage: one stray keystroke is enough to
damage a text you will not proofread again.

It is a safety catch, not a security feature: one click removes it.

## 6. Read

Press **Start** (or the space bar). Allow microphone access if asked. Then read
normally.

What you see while reading:

- the **current word** lights up in amber;
- what has **already been said** fades out;
- what **remains to be said** stays the most legible — that is what you read;
- the text **scrolls by itself** to keep the current word a third of the way
  down the screen;
- the **tracking state**, top right: *suivi* (green, locked on), *suivi faible*
  (amber, weak), *perdu* (red, blinking — lost).

### If tracking drifts

The `↑` and `↓` arrows move the cursor one word. The engine resumes from there.
In practice it recovers on its own in most cases, including after an entirely
skipped paragraph.

## 7. Writing assistance

Four functions, in the **Assistance** panel. They need an Anthropic key, which
you supply yourself.

| Function | What it does |
|---|---|
| **Rewrite for speaking** | Breaks up long sentences, removes constructions that only work on the page, places pauses and marks the words to stress |
| **Fit the target duration** | Expands or trims to fit the time you set, preserving the opening and the closing |
| **Backup cards** | One line per idea, with the exact opening words of each passage — what you glance at if you lose your place, standing, under pressure |
| **Audience questions** | The six most likely questions, the most dangerous first, with what makes each hard. At least two substantive objections, and your blind spots named |

**Your text is never replaced without your consent.** A rewrite appears at the
bottom of the screen first; you decide whether to apply it.

### The key

The principle is bring-your-own-key: each person supplies their own, it is
stored on their device, and no key ships with the app. That is what makes it
possible to share the tool without sharing a secret and without hosting a
server.

Get one at [console.anthropic.com](https://console.anthropic.com), then paste it
into the panel. It is never shown in full again; the **effacer la clé** button
removes it.

An honest caveat: the key travels from the app itself, which makes it readable
by anyone with access to your device — like any password saved in a browser. On
your own machine that is the normal trade-off; on a shared computer, clear it
after use.

The text you submit is sent to Anthropic and handled under their terms. The
app's other functions — voice tracking, timing, the library — send nothing
anywhere.

## Keyboard shortcuts

| Key | Effect |
|---|---|
| `Space` | start or stop |
| `L` | lock or unlock the text |
| `F` | full screen |
| `↑` `↓` | nudge the position by one word |

## Your texts

Each text is saved automatically as you type, with its title, word count and
estimated duration. The list is sorted most recently edited first, and the
filter field finds a text by title.

The title is inferred from the first section heading, or from the opening words
if there is none. You can always replace it.

Texts are stored **on your device**, not on a server. They are not synchronised
between machines, and clearing browser data deletes them.
