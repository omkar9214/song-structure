# Song Structure

Write down the shape of a song the way a band actually writes it: **one block = one bar
= 4 beats**, bars grouped into named sections, sections repeated `×N`, with pointers and
media attached where you need reminding.

No install, no build, no account. Everything stays in your browser.

**Live at [omkar9214.github.io/song-structure](https://omkar9214.github.io/song-structure/)**

## Run it

Double-click `index.html`, or serve it:

```bash
python3 -m http.server 8712
```

then open http://localhost:8712.

(Serving it is slightly better — some browsers restrict IndexedDB, which stores your
media files, on `file://` URLs.)

## How it works

The page reads like a chart: **four bars to a row, sharing barlines**, each row enclosed in
a box with a **slim region strip** across the top carrying the region name — Intro, Verse,
Chorus — the way regions sit above items in Reaper. A region longer than four bars simply
continues on the next row, marked *cont.*

**Header** — title, artist, key, BPM, time signature, for the top of the chart.

**Roadmap** — auto-built from your regions: `Intro · Chorus ×2`. Click a chip to jump to it.

**The song itself** — above the roadmap, *Add the song (mp3)* attaches the recording this
chart is of. Once it is there, every 📎 offers **a clip of the song** as well as a file: the
trimmer gives you start/end sliders, editable `m:ss.s` timestamps, a *Play clip* preview and
*Start here / End here* buttons that mark the point you are listening to. Attach as many clips
as you like from that one mp3 — a region gets the whole chorus, a bar gets the fill leading
into it. A clip stores only two numbers, so a hundred of them cost nothing.

The **Clip** button on the track bar cuts first and asks where second: make the clip, then
click 📎 on whichever region or bar should carry it.

**Regions** — `+ Add region` asks for a name, a bar count and a repeat. Hover the strip for
its tools:

| | |
|---|---|
| ×N | repeat count — shows as a `×2` badge next to the name |
| 📌 | add a pointer / cue |
| 📎 | attach image, audio or video to the whole region |
| + | add one more bar |
| 🎨 | cycle colour |
| ↑ ↓ | reorder |
| ⧉ | duplicate the region |
| ✕ | delete |

Click the name to rename it. The caret on the left collapses the region down to just its
strip, so a long song stays scannable.

**Bars** — one box per bar, with the chord written large in the middle. Hover a bar for
**chord fields**, **duplicate**, **attach** and **delete**.

**Barlines are editable.** Hover a bar and a small **×** appears on its left barline: click it
and that barline goes away, joining the two bars into a single 8-beat block spanning two
columns, numbered `3–4`. A merged block carries a dashed **+** where the barline used to be —
click that to put it back. Blocks can be up to four bars wide.

**Chord fields** are separate from the block's length. The first tool cycles a block through
1 → 2 → 3 → 4 fields (and 6 and 8 once it spans more than one bar). One field is the chord
written big across the whole bar; more fields let one block hold `Am … F` the way a chart
shows two chords in a measure. It is still **one block** either way — only the number of text
fields changes.

**Moving blocks** — the first tool on every block is a grip. Drag it anywhere: within the
region, into another region, before or after any bar — a blue line shows exactly where it will
land. It is one pointer-driven drag, so it works with a mouse *and* with a finger (HTML5
drag-and-drop never fires on touch). With the keyboard, focus the grip and press `←` / `→` to
step the block one place at a time; at the edge of a region it hops into the next one.

Under each bar is a faint line for a lyric or a short cue; it stays visible once you type in
it.

The small dashed **+** just outside the end of a region adds a bar. It sits outside the box on
purpose: it is a button, not a bar, and keeping it out of the grid means every bar keeps its
true width no matter how full the row is.

**Pointers / cues** — `📌` pins a marker in the lane just above the bars, anchored to a bar:
*🎤 Vocal starts here*, *🥁 Drums enter*. Click a marker to edit it, ⌥-click to remove it.

**Media** — attach from any 📎, or **drag a file straight onto a region**. Attachments show as
small icons (🖼 🔊 🎬) in the corner of the bar, or in the region strip. Click one to view or
play it; the viewer has a Remove button. Files are stored locally in IndexedDB, so video is
fine. This is the fix for "I see the region and can't remember what it was".

**PDF** — hands the chart to your browser's print dialog with the editing controls stripped
out; choose *Save as PDF* (or *Destination → Save as PDF*) and the file is named after the
song. The layout you see is the layout you get.

**Songs / New** — multiple songs live in the drawer. The drawer also holds **Back up** and
**Restore**, which write and read a JSON file with the media embedded — that is the way to
move a song to another machine, since a PDF cannot be edited back.

### Keyboard

- `Enter` in a bar → jump to the next bar
- `←` `→` at the edge of a chord → step between fields, then between bars
- `Backspace` in an empty beat → step back a beat
- `N` (outside a text field) → new region
- `←` `→` on a block's grip → move that block one place
- `Esc` → close a dialog / viewer

## Sync (optional)

Everything works offline with no account — the cloud is a layer on top, not a requirement.

**Sign in** in the top bar emails you a link (no password). After that:

- songs sync to Postgres as JSON, pushed 1.5 s after you stop typing, newest-write-per-song wins;
- mp3s, chord diagrams and video upload to Storage as you attach them;
- on another device, sign in with the same email and your songs appear. An attachment downloads
  the first time you open it and is then cached locally, so it plays offline afterwards.

The dot on the Sync button is the status: grey signed out, blue pulsing while saving, green synced,
red failed. A failure never loses work — the local copy is always the source of truth.

**One-time project setup** (already configured in `config.js`):

1. Supabase dashboard → **SQL Editor** → paste `supabase-setup.sql` → Run. That creates the
   `songs` table, the `media` bucket, and row-level-security policies that restrict every row and
   every file to the account that owns it.
2. **Authentication → URL Configuration** → add both app URLs to *Redirect URLs*, so the
   sign-in link is allowed to come back:
   `https://omkar9214.github.io/song-structure/**` and `http://localhost:8712/**`.

Both values in `config.js` are publishable on purpose — the key grants nothing that the policies
do not allow.

Audio and images live in this browser's IndexedDB, so a second browser starts without them.
Signed in, the app fetches a missing file from the server the first time you play it and caches
it locally from then on. Signed out, it says so instead of failing silently.

**Free-tier limits**: 1 GB of files, 500 MB of database, and the project pauses after 7 days with
no requests (one click to restore, nothing lost).

## Design notes

Run through `ui-ux-pro-max` and applied where it fit:

- **SVG icons, never emoji** (`icons.js`, Lucide-style outline paths, inlined — no CDN).
  Emoji render differently on every platform and carry no accessible name. The one place
  emoji remain is the cue markers, where the icon is *content you picked*, not UI chrome.
- **Tooltips on hover** for every icon-only control: 400 ms delay, instant on keyboard focus,
  dismissed with `Esc`, flipped below the element when there is no room above (WCAG 1.4.13).
  Every icon button also carries an `aria-label`, so the tooltip is never the only label.
- **Contrast**: region strips are solid colour with white text; barlines are `#7d7a70`, dark
  enough to actually read. No gray-on-gray.
- **Focus** is always visible (`:focus-visible` ring), and `prefers-reduced-motion` kills every
  transition.
- **Touch**: hover-only controls are always visible and grow to 38 px targets under
  `@media (hover:none)`; `touch-action: manipulation` removes the 300 ms tap delay.
- `prompt()` and `confirm()` are gone — both are blocked in some embedded browsers and look
  nothing like the app. Repeat is edited inline in the strip; deletions use a real dialog.

From `ui-styling` — its React/shadcn/Tailwind stack does not apply here (no build step, no
React), but its accessibility chapter is framework-independent and is applied in full:

- Skip-to-chart link, `<main>` landmark, an `<h1>` for screen readers.
- Every input has an accessible name (`Chord for bar 3, beat 2`, `Lyric or cue under bar 7`),
  every icon-only button an `aria-label`. Verified: zero unnamed inputs, zero unnamed buttons.
- Each region is a labelled landmark — *"Chorus, 8 bars, played 4 times"*.
- Toasts announce through an `aria-live="polite"` region.
- Dialogs are native `<dialog>`, so focus is trapped, `Esc` closes and focus returns to the
  trigger for free; each is named with `aria-labelledby`. Required fields are marked `*` plus
  a screen-reader "(required)".

What the tool suggested and I did **not** take: its palette (video-pink on navy) and the
"Hero-Centric" landing-page pattern, neither of which suits a chart you read while playing.

## Files

| | |
|---|---|
| `index.html` | markup and dialogs |
| `app.css` | styling, light + dark, print stylesheet |
| `icons.js` | inline SVG icon set |
| `cloud.js` | Supabase sync — songs, attachments, auth |
| `config.js` | Supabase project URL and publishable key |
| `supabase-setup.sql` | run once: tables, bucket, security policies |
| `db.js` | IndexedDB media store |
| `app.js` | state, rendering, all interaction |
| `RESEARCH.md` | how song structures are notated, and why the app is shaped this way |

## Storage

Song text lives in `localStorage` (`song-structure.v1`), media blobs in IndexedDB
(`song-structure`). Both are per-browser and per-origin. Nothing is uploaded anywhere.
**Export anything you care about** — clearing site data wipes both.
