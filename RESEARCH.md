# How song structures are actually written down

Research notes behind the design of this app.

## 1. The four real-world notation traditions

| Tradition | What it looks like | What it optimizes for |
|---|---|---|
| **Standard notation / lead sheet** | Staff, melody, chord symbols above, barlines, repeat signs | Exact pitch + rhythm. Slow to write, needs reading skill. |
| **Chord chart (bar/measure grid)** | `\| C \| C \| F \| G \|` — one cell per bar, 4 bars per line | Harmony + form. Fast to write, readable at a glance. |
| **Nashville Number System (NNS)** | Same grid, but chords as scale degrees `1 4 5 6-` | Key-independent. Session standard. |
| **DAW arrangement view** | Named, colored, timed blocks on a timeline (Logic/Ableton markers) | Structure only. Visual, reorderable. |

This app is a **bar-grid chart with a DAW-style section layer** — the two traditions that
non-readers actually use — plus attached media, which paper cannot do.

## 2. The conventions worth stealing

**The bar is the atom.** Everything in a chart is counted in bars (measures). 1 bar of 4/4 = 4 beats.
Charts are written 4 bars per line, with 8-bar phrases split visually 4+4, because pop/rock phrasing
is almost always in 4s and 8s. → *App: one block = one bar = 4 beats, grid wraps at 4 per row.*

**Beat subdivision inside the bar.** When two chords share a bar, charts use tick/hash marks under
the chord to show how many beats each gets (`C  /  /  F` or `\| C . . F \|`). A diamond over a chord
means "let it ring the whole bar". → *App: each block has 4 beat slots; leave 2–4 blank and the
chord holds.*

**Sections are named and separated.** Every chart puts a section label in the left margin — Intro,
Verse, Pre-Chorus, Chorus, Bridge, Solo, Breakdown, Outro/Tag — and separates sections with space or
a double barline. Choruses are typically 8 bars, often 16. → *App: sections own their bars, are
colored and collapsible.*

**Repeats are counts, not symbols, in band charts.** Formal notation uses `|: :|`, 1st/2nd endings,
D.C./D.S. al Coda, and a coda sign. Working band charts collapse all of that to **`x4`** written
next to the section. It is unambiguous and needs no explanation at rehearsal.
→ *App: a repeat multiplier per section, displayed as `×4`.*

**The roadmap.** Pro charts put a one-line form summary at the top:
`Intro – V1 – Ch – V2 – Ch – Bridge – Ch x2 – Outro`. Players read it once and know the shape.
→ *App: auto-generated roadmap strip, always in sync.*

**Cues / rehearsal marks.** Above the staff, charts carry short performance pointers: *vocal in*,
*drums enter*, *build*, *drop out*, *half-time*, *watch the stop*, *guitar solo 8 bars*, dynamics
(`p`, `f`, `cresc.`), and rehearsal letters A/B/C for "start from letter B".
→ *App: cues pinned above the bar grid, each anchored to a specific bar.*

**Header block.** Every chart carries title, artist, key, tempo (BPM), and time signature at the top.
→ *App: same header; BPM also drives the runtime estimate.*

## 3. What paper can't do, and this app does

The failure mode the user described — *"if I see a section I don't remember what it was"* — is real
and is exactly what a paper chart can't fix. A chart records **form**, not **sound**. So:

- **Media on any section or any bar**: image (a fretboard photo, a screenshot of a tab), audio
  (a voice memo of the riff), video (a phone clip of the part being played).
- Media is stored locally in IndexedDB, never uploaded.
- A bar or section with media shows a badge; click to play/view inline.

## 4. Design consequences

1. One block = one bar = 4 beats. Non-negotiable atom, matches every chart tradition.
2. Duplicate is the primary editing verb — real charts are `\| C \| C \| C \| C \|`, i.e. the same bar
   repeated. Typing it four times is the wrong interaction.
3. Sections are created by *count* ("Chorus, 8 bars"), because that is how musicians think and say it.
4. Repeats are `×N` on the section, not barline symbols.
5. Cues sit above bars and point at a bar, mirroring the staff convention.
6. Everything stays local. No account, no server.

## Sources

- [The Nashville Number System Demystified — Sweetwater](https://www.sweetwater.com/insync/the-nashville-number-system-demystified/)
- [Ultimate Guide to the Nashville Number System — Premier Guitar](https://www.premierguitar.com/lessons/chords/nashville-number-system)
- [Nashville Number System — Wikipedia](https://en.wikipedia.org/wiki/Nashville_Number_System)
- [Anatomy of an arrangement: your guide to song sections — MusicRadar](https://www.musicradar.com/how-to/song-sections-explained-intro-verse-chorus-middle8-outro-tag-bridge)
- [Song Structure: Examples, Tips, and Common Formats — Splice](https://splice.com/blog/an-introduction-to-song-structure/)
- [Song structure — Wikipedia](https://en.wikipedia.org/wiki/Song_structure)
- [Arranging Music: Guide to Building Song Structure — Avid](https://www.avid.com/resource-center/arranging-music-guide)
