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

Click into the text, in the middle of the screen — or press **éditer**, or the
`E` key. The text becomes editable **where it stands**, in the same column, the
same typeface and the same size: what you write is already laid out like what
you will read.

Clicking **lire** again, or pressing `Escape`, returns to reading.

Six annotations are available:

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

Open the settings — the gear, top right — and push the **Durée visée** slider.
As soon as you start reading, the **Ahead / behind** indicator compares your actual progress with
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
- **Theme**: automatic, light or dark. In a darkened room, dark tires the eyes
  less and lights your face less.

All of these live in the gear panel, which slides over the text without hiding
it: you see what a slider does while you push it.

## 5. The text protects itself

There is nothing to lock before going on stage. In reading mode the text is no
longer an input field but a composed page: no stray keystroke can damage it.

Editing closes itself when reading starts, and the **éditer** button stays
disabled while tracking runs. While you speak, the text does not move.

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

## Keyboard shortcuts

| Key | Effect |
|---|---|
| `Space` | start or stop |
| `E` | switch between reading and editing |
| `Escape` | close the settings, the menu, or editing |
| `F` | full screen |
| `↑` `↓` | nudge the position by one word |

## Your texts

The title shown at the top of the screen is also the menu of your texts: open
it to pick another, create one, or delete the one in front of you.

Each text is saved automatically as you type, with its title, word count and
estimated duration. The list is sorted most recently edited first, and the
filter field finds a text by title.

The title is inferred from the first section heading, or from the opening words
if there is none. You can always replace it.

Texts are stored **on your device**, not on a server. They are not synchronised
between machines, and clearing browser data deletes them.
