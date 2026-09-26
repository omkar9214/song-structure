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

**Volume is remembered per thing.** The song keeps its own level, and so does every clip and
attachment — a quiet voice memo does not come back at the level you last used for the full mix.
Mute is remembered too.

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

A chord too long for its bar shrinks to fit — `Abmaj7#11/Eb` in a quarter-width field drops as
far as 10px rather than spilling over the barline. Short chords keep their full size, and the
sizes are recalculated when the window changes width.

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

### The pulse

A silent metronome sits with Key / BPM / Time on the chart, and in the gig bar. It is always
running — there is nothing to start — so the tempo is there to catch before the count-in.
One dot per beat in the bar, the downbeat drawn in the accent colour so "one" is findable
without counting the row. A song with no BPM written on it has no pulse: the auto-scroll
falls back to 100 when there is no tempo, because a chart that does not move is useless,
but a metronome guessing at the tempo is simply wrong.

It is driven by CSS animation rather than `requestAnimationFrame`. A permanent rAF loop is
battery spent for the length of a gig, and a main thread busy re-laying out a chart makes a
JS-timed pulse stutter — a metronome that hesitates is worse than none. The keyframes are
rebuilt per time signature, because "how much of a bar is one beat" is exactly what the time
signature says and keyframe stops cannot be a CSS variable.

At phone width the gig bar is already exactly full, so there the pulse wraps onto its own
line under it rather than squeezing the song title away. The jump menu hangs off the bar's
measured height for that reason, not a fixed 56px.

### Gig mode

The **Gig** button (or `G`) swaps the editor for a read-only rendering of the same song:
no inputs, no tools, no dialogs, so nothing can be knocked out of place mid-song. Every
cue is on, including the line under each bar. `A−` / `A+` scales the whole chart for
however far away the stand is and remembers where you left it, and the screen is kept
awake while gig mode is up. `✕` or `Esc` leaves.

Gig mode asks the browser for the whole screen on the way in, so the tab strip and address
bar are not eating a band of chart, and gives it back on the way out. **It does not ask on
an iPad or iPhone.** iPadOS grants it and then spends it: a floating close button parks
itself over the song title, and a swipe anywhere near the top drops straight back out —
mid-song. Neither is something the page can turn off. iPadOS reports itself as a Mac, so
the touch count is what tells them apart; no Mac has one.

**On an iPad, Share → Add to Home Screen is the answer**, and a better one than fullscreen
was: the manifest is `display: standalone`, so the installed app has no browser chrome at
all, nothing overlaid on the chart, and no gesture that can undo it.

**Auto-scroll** is the ▷ in the gig bar (or `Space`). Musical time underneath comes from
the clock: each row is worth exactly as long as the music written on it — bars ×
beats-per-bar × the region's repeat, at the song's BPM — so a `×4` chorus drawn once
holds for all four passes and nothing drifts out of time over a five-minute song, and a
throttled repaint is a moment it catches up on rather than a second it loses.

**The chart turns pages rather than creeping.** The first version pinned the played bar at
a third of the way down and scrolled continuously to keep it there, which is right for a
playhead and wrong for reading — the page is never still, so the eye never settles, and
the slider was being run at its slowest setting to fight it. Now the chart holds
completely still while the played bar is anywhere comfortable, and only when that bar
falls past **76% of the visible height** does it scroll — once, eased, over about half a
second — to put the bar back at **26%**. Then it holds again. Both numbers are fractions
of the visible height, so it answers to the type size and the screen on its own: bigger
type means fewer bars on screen means more frequent turns, and there is nothing to set.

Measured at 834×1112, 44 bars: still at the top for 12.4s while the played bar travelled
70 → 820px, one 0.6s turn to 526px, still again for 7s, then the last turn. Hold, turn,
hold.

The **⚙ slider** button opens the speed strip — pause, back-to-the-top, and a slow/fast
slider from 30% to 200% — and it stays shut until you ask for it, because it is a setting
and not something you reach for mid-song. **The speed is remembered on the song**, not on
the device. Tapping anywhere on the chart pauses and resumes; scrolling by hand takes over
and resumes from where you put it.

A region with no bars left in it is **not drawn in gig mode**. It used to put its coloured
name strip on the chart with no music under it — a stripe at the end of the song — and it
was counted, so the scroll sat on nothing for a bar times the region's repeat. Nothing is
deleted: the region is still in the editor to remove, and one carrying a note is still
drawn, because a note is information.

**Whether it is running is readable from across a room**, because forgetting to press play
is the mistake that actually happens. Stopped, the ▷ breathes. Running, it is a filled
block and a line under the bar visibly travels through the song. Paused, the line is there
but grey and still.

### Setlists

Scrolling inside the drawer stays inside the drawer. On iPad a drag on the dark area beside
it used to scroll the chart underneath — measured, 834×1112: the document went 0 → 500 —
and once the page had taken the gesture the list stopped responding until you lifted your
finger. The page is not frozen to fix it (`overflow:hidden` on the body is what cost us the
scroll position on WebKit before); instead nothing in the drawer but the list may pan, the
list keeps its overflow to itself, and a wheel outside the list is swallowed.

A setlist is one gig: a named, ordered list of songs, in the second tab of the drawer.
**Start** opens the first song in gig mode and `‹` `›` walk the running order; the setlist
name in the gig bar drops down a list to jump to any song in it. Setlists hold ids, not
copies — deleting a song only takes it out of the running order — and they sync with your
songs when you are signed in.

Setlists are also **folders**. In the Songs tab a song filed into a setlist sits under
that setlist rather than in the long flat list, and what is left at the bottom, under
*Not in a setlist*, is only what has not been filed yet. A song in two setlists shows
under both — it is one song, not a copy. The ≡ on any song row files it into a setlist or
takes it out, and the search box above cuts through the folders to every matching song.

### Why the chart is not made of `<input>`s

A browser's own password manager offers its list of saved logins on any form
field it finds focused, whatever the page says about itself, and iOS puts an
AutoFill bar over the keyboard for the same reason — so tapping a chord got a
dropdown of unrelated websites. Telling managers to ignore the field does not
help, because the decision is not made per field.

So the chart is not made of form fields. Chords, cue lines, region names and
the song's title, artist and key are editable text elements — same look, same
typing, same keyboard moves, but not something a browser can mistake for a
login box. `textBox()` in `app.js` builds them: plain text only, Enter moves to
the next bar rather than starting a paragraph, and a paste arrives as text.

The dialogs keep real inputs, and the sign-in dialog is the one real `<form>`.
Its password and email fields are ordinary text until it opens, so at rest the
page holds no credential field at all — and while you are deliberately signing
in, saving a password works exactly as it should.

### Touch

There is no hover on a touch screen, and Safari fires `:hover` on a tap, so the tool row
used to spring open over the block you were trying to type in. On touch, nothing opens by
itself: **⋯** on a block or a region opens an action sheet with labelled, thumb-sized rows.
Every field you can type in is 16px there, because Safari on iOS zooms the page when it
focuses anything smaller and does not zoom back out.

### Keyboard

- `Enter` in a bar → jump to the next bar
- `←` `→` at the edge of a chord → step between fields, then between bars
- `Backspace` in an empty beat → step back a beat
- `N` (outside a text field) → new region
- `G` → gig mode; in gig mode `←` `→` change song, `+` `−` change size
- `←` `→` on a block's grip → move that block one place
- `Esc` → close a dialog / viewer / gig mode

### Theme

**Theme** in the drawer cycles System → Light → Dark, remembered on that device. System
follows whatever the phone or laptop is set to, which is right most of the time; Dark is
there for a dark stage in daylight hours.

### Empty songs

Opening the app on a device with no local copy yet puts an empty song on
screen while the real library is fetched — and that empty song used to be
pushed to the account, so every new device and every cleared browser left
another *Untitled* behind.

Two rules now. **An empty song is never sent to the account**, at any of the
places a song can be pushed; the first thing you write in it is what makes it
real. And **the empty song made at boot is dropped the moment the library
arrives**, so you land on a song instead of a blank page.

"Empty" errs entirely towards keeping: a title, an artist, a key, a note, a
region, an attachment, an mp3, or a tempo or time signature moved off the
default all make a song worth keeping. A wrong "not empty" costs one stray
row; a wrong "empty" would lose work.

The ones already in the account are cleared up deliberately, never
automatically: the Songs tab offers **Remove _n_ empty** when there are any,
and the song you have open is always spared.

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

### When two devices change the same song

Each device remembers the version of each song it last agreed with the server on. If only
one side has moved on from that point, that side wins, quietly — the ordinary case. If
**both** have moved — you changed a song on the laptop, then changed the same song on the
iPad before it had seen the laptop's version — neither is thrown away: the copy on the
device in your hands stays as the song, and the other one is kept beside it as
*"<title> (other device, Sep 23 14:32)"*. Both end up on both devices, and a message tells
you it happened.

Setlists are still newest-wins as a whole list, since a running order merged half-and-half
would be worse than either version.

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

Song text is written **twice on every save**: to `localStorage` (`song-structure.v1`),
which is what the app boots from because it is synchronous, and to the `vault` store in
IndexedDB (`song-structure`, alongside the media blobs). `localStorage` is a small box a
browser is allowed to empty on its own, and when it does, a device with no signal has
nothing to show. So the boot compares the two and **puts back anything the quick slot has
lost** — it only ever adds, because a song deleted on purpose must stay deleted. A
`localStorage` write that fails says so instead of being swallowed.

The Songs tab says what this device is actually holding: how many charts, how many
attachments are here rather than only in the account, and when it last agreed with the
server. **Get _n_ for offline** downloads the attachments this device has not got, which
is what makes a chart complete with the phone in airplane mode. (A clip is not a file of
its own — it is a start and an end inside the song's mp3 — so fetching that one mp3 makes
every clip taken from it play offline.)

**Back up all** writes every song and setlist to one JSON file, optionally with the audio
and images on this device. It restores on any machine and into a brand new account, and
restoring never overwrites: a song already there is left alone, an edited one arrives
beside it as *(from backup)*, and an identical one is skipped rather than duplicated.
