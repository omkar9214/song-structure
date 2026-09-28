# Resources and lyrics — design

**Date:** 2026-09-28
**Status:** awaiting review
**Baseline:** HEAD `1701c72`, live at `?v=20260926-6`

---

## 1. What this adds

Three features, agreed in this session:

1. **Resources** — a panel under the existing track bar holding links (YouTube, Spotify,
   Apple Music, Tidal, SoundCloud, Bandcamp, Amazon Music), sheet music (PDF or image) and
   the lyric sheet.
2. **Lyrics** — paste a whole lyric sheet once, then assign it to bars by pointing rather
   than typing. Shown on stage as a toggleable column beside the chart, following the
   playhead bar by bar, and as the per-bar cue under the chords.
3. **A resources folder on the device** — a real folder the user picks, holding their
   attached files, changeable, with a copy-over prompt on change.

## 2. Decisions taken, verbatim where he gave them

| # | Decision | Source |
|---|---|---|
| D1 | Option **C** for lyrics on stage: *"The lyric window can be opened or closed (depends on the user)"* | his words |
| D2 | The column follows the chart **bar by bar** | chosen from three |
| D3 | Assignment is the **walk**: tap to place, sequential, never guessed | chosen from three |
| D4 | A `×N` region holds **words per pass** | chosen from three |
| D5 | Sheet music gets a **real reader that works on stage** (ship pdf.js) | chosen from three |
| D6 | Resources are stored in a **folder on the device**, chosen from the account section, changeable, with a copy-or-not prompt; *"it will work offline as well"* | his words |
| D7 | The existing "Add the song (mp3)" row is **unchanged**; Resources sits underneath it | his words |

## 3. Platform facts, verified

Checked against MDN `@mdn/browser-compat-data` **v8.1.3**, fetched 2026-09-28. Not recalled.

| API | Chrome / Edge desktop | Safari macOS | Safari iOS & iPadOS | WebView iOS |
|---|---|---|---|---|
| `Window.showDirectoryPicker()` | 86 | **false** | **false** | **false** |
| `StorageManager.getDirectory()` (OPFS) | 86 | 15.2 | 15.2 | 15.2 |
| `StorageManager.persist()` | 55 | 15.2 | 15.2 | 15.2 |
| `<input webkitdirectory>` | 7 | 11.1 | **18.4** (11.3–18.3: settable, no effect) | 18.4 |

**Consequence.** A user-visible folder is impossible on the iPad. Every browser on iPadOS
is WebKit, so this is not routed around by installing another browser. This is the one
point where D6 and the platform disagree, and §7 says what is built instead.

## 4. Data model

Nothing migrates. No `migrate()` change is required by this spec, and no existing field
changes meaning.

### 4.1 Links — new

```js
song.links = [ { id, url, title, provider, addedAt } ]
```

`provider` is one of `youtube | spotify | apple | tidal | soundcloud | bandcamp | amazon |
web`, derived from the host at paste time and stored, so an offline device still labels the
chip correctly. Links are plain text: they ride in the existing `data jsonb` song row, need
no upload, and cost nothing in the offline audit.

### 4.2 Sheet music and files — existing

Unchanged. `song.media[]` already uploads, syncs, backs up and counts toward
"Get *n* for offline". One addition: `Media.kind()` in `db.js` learns `pdf` for
`application/pdf` and `.pdf`. Records already stored as `kind:'file'` are treated as PDFs at
render time when their `type` says so, so nothing has to be rewritten.

### 4.3 Lyrics — new

```js
song.lyrics = {
  text: "",        // exactly what was pasted. Never rewritten by the app.
  cuts: [ { bar: <barId>, pass: 1, from: 0, to: 22 } ]
}
```

A **cut** is a slice of `text` pointed at a bar. The array is the entire assignment.

Three properties follow, and they are the reason for this shape rather than copying words
onto bars:

- The column can light **the exact text the current bar is singing**, because the bar points
  into the sheet instead of owning a copy of it.
- Per-pass repeats (D4) are free: a cut carries `pass: 2`.
- **Every lyric already typed by hand survives.** Rendering a bar's cue prefers its cut and
  falls back to the existing `bar.lyric` string. Nothing is rewritten and nothing is dropped.

`bar.lyric` keeps its current meaning — a hand-typed cue — and stays editable as it is today.

**Re-matching after a sheet edit.** Cuts are made in order and consume the sheet in order,
so after the text changes they are re-found in one sequential pass (`indexOf` from the end of
the previous match). A cut that cannot be re-found is **flagged in the walk, never silently
dropped**, and its bar keeps showing the words it had.

## 5. Resources panel (editor)

The track row is untouched. Below it, a collapsed **Resources** button opens a panel in
three parts. Collapsed by default, remembered per song.

**Links.** Paste a URL; the app names the provider and pre-fills the title from the URL where
it can. A chip per link. Tap opens an in-app overlay containing the provider's embed.

| Provider | Embed |
|---|---|
| YouTube | `youtube.com/embed/<id>` — plays in full |
| Spotify | `open.spotify.com/embed/...` — **30-second preview** unless the browser is logged into Spotify, which in a third-party iframe on iOS it generally is not |
| Apple Music | `embed.music.apple.com/...` — preview |
| Tidal | `embed.tidal.com/...` |
| SoundCloud | `w.soundcloud.com/player` |
| Bandcamp | `bandcamp.com/EmbeddedPlayer` |
| Amazon Music | **no public embed exists** — the chip reads "Open in Amazon Music" and leaves the app |

Every link needs signal. This is stated in the panel, not discovered at a gig.

**Sheet music.** Attach a PDF or image. Chips as above; tap opens the reader (§6).

**Lyrics.** A textarea to paste the sheet. Once text exists, a second button:
**Fit lyrics to bars**, which opens the walk (§7).

## 6. The sheet music reader

`pdf.js` is vendored into the repo as plain files (`vendor/pdf.min.js`,
`vendor/pdf.worker.min.js`) — **no build step, no bundler, no CDN**, per AGENTS.md §3. Pages
render to canvas; page turns by swipe or by arrow buttons; pinch to zoom.

Both files join `SHELL` in `sw.js` so the reader works with no signal. This grows the
precache by roughly 1 MB and **requires the `V` bump and an offline check**, not an
assumption (§10).

Openable from the editor and from gig mode.

## 7. Lyrics: the walk

Full-screen overlay, opened from Resources. Read-only on the chart side; it writes only cuts.

- The **sheet** on one side. Every word is a tap target. Words already consumed are dimmed.
  The current selection is highlighted.
- The **chart** on the other, compact, with the target bar ringed.
- On iPad portrait the sheet is on top and the chart below; landscape puts them side by side.

Controls, all ≥40px: **Place** (drops the selection on the ringed bar, advances the cursor
past it and the ring to the next bar), **Skip** (leaves the bar blank and advances),
**Back** (undoes one cut), **Done**.

Tapping a word extends the selection to it; tapping inside the selection pulls it back.

A `×N` region offers its bars N times, so pass 2 simply continues the walk with the next
words (D4).

Stopping early is normal: unassigned bars stay blank and the walk resumes where it left off.

**No dragging anywhere in this feature**, per AGENTS.md §5.

## 8. Gig mode

Two buttons join the gig bar, each shown only when this song has the thing:

- **LYRICS** — toggles the column.
- **SCORE** — opens the reader.

Both are 44px, both read-only. No new way to edit anything from the stage.

**The column.** 250px on the right, the full sheet, the current cut lit and scrolled to
centre. Open/closed is the user's choice and is remembered per device (D1).

**What drives the highlight.** Auto-scroll's playhead while it is running. When it is not,
tapping any bar moves the highlight there and the column scrolls to match — so the column is
never stuck whether or not the play button was pressed.

**The cue under the chord** shows the cut for the current pass, falling back to `bar.lyric`.

**Links do not appear in gig mode.** They need signal and the user is playing.

Region and bar attachments are unchanged — clip or file, no links. Resources are a
song-level thing.

## 9. The device resources folder (D6)

### 9.1 Architecture

IndexedDB remains the store of record. The folder is a **mirror**, written alongside it,
never instead of it. This is deliberate: IndexedDB is what makes the iPad work with no
signal — confirmed by a real airplane-mode launch on 2026-09-28 — and no part of the stage
path moves onto an API the stage device does not have.

### 9.2 Desktop (Chrome, Edge)

In the account section, **Create resources folder** calls
`showDirectoryPicker({ id: 'song-resources', mode: 'readwrite' })`. The handle is persisted
in IndexedDB.

- Every resource attached from then on is also written into the folder as a real file,
  named `<song title> — <resource name>.<ext>`, de-duplicated with a numeric suffix.
- On load the handle's permission is queried; if it is not `granted`, the panel shows
  **Reconnect folder**, because re-granting requires a user gesture. The app works normally
  without it.
- **Changing the folder** asks: *copy the existing resources across, or not?* Declining is
  supported and leaves two folders with different material, both valid — this is what he
  asked for, not an error state.

### 9.3 iPad and iPhone

`showDirectoryPicker` does not exist. The same panel states that plainly and offers what
WebKit does allow:

- **Import from a folder** — `<input webkitdirectory>` reads a Resources folder out of Files
  in one shot. Requires **iPadOS 18.4+**; the capability is feature-detected and the panel
  says so when it is older, rather than presenting a control that does nothing.
- **`navigator.storage.persist()`** is requested so iOS stops treating the resources as
  evictable cache. The granted/denied result is shown.

No pretend folder, and no control that silently fails.

## 10. Verification plan (AGENTS.md §1)

Before any claim is made about any of this:

1. `?v=` bumped in all six tags of `index.html` **and** `const V` in `sw.js`, matching.
2. `node --check` on every touched file.
3. Screenshots of: the Resources panel, each embed, the PDF reader, the walk, and the gig
   column — at **desktop, iPad portrait 834×1112, iPad landscape 1180×820, phone 375×812**,
   in **light and dark**.
4. Measured, not asserted: that the column at 250px does not push `fitGigChords()` below its
   11px floor on a split bar in portrait; that the walk's controls do not overlap the chart.
5. **An offline load with the pdf.js files in the cache** — the precache grew, so this is
   checked, not assumed.
6. Touch rules exercised via the shipped media query, per AGENTS.md §1.6.
7. Deploy, poll until live, grep the live JS for the new functions.

## 11. Stated as unverifiable by me

- **Real iPad hardware.** Everything is checked in the browser pane at iPad dimensions; that
  is an emulation. iOS Safari's handling of third-party embed iframes, pdf.js canvas
  performance on the actual device, and `webkitdirectory` behaviour in Files all need his
  hands.
- **His iPadOS version** — the `webkitdirectory` import needs 18.4+ and has not been checked.
- **Spotify, Apple Music and Tidal embeds** will be checked in the pane; whether they behave
  the same in iOS Safari with its third-party storage rules will not be.

## 12. Explicitly out of scope

- Guessing or auto-aligning lyrics to bars — rejected in favour of the walk (D3).
- Drag and drop anywhere in the walk (AGENTS.md §5).
- Links in gig mode.
- Links or PDFs on regions and bars; those keep clip-or-file.
- Any build step, bundler or framework (AGENTS.md §3).
