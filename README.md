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

The title and the setlist position used to be two controls side by side, and between them
they left the title 165px on an iPad in portrait — with SCORE and LYRICS both present, a
long title was simply cut off. They are one control now: the title carries the position in
its own text flow — *At Last  2/20* — and the whole thing is the button that opens the
running order.

**Nothing else in that bar ever moves.** Every button is in the same place on every song,
because that is the row he reaches for mid-song without looking: SCORE and LYRICS are
dimmed rather than removed when a song has neither, the artist line keeps its height
whether or not there is an artist, and the title sits in a fixed 20px box. A title too
long for the space shrinks to fit rather than wrapping — down to 12px, below which it
would not be readable from a mic stand and the ellipsis is the honest answer. The title
is the only thing in the bar allowed to give.

**Tap** beside it plays the tempo in rather than typing a number you guessed. Tap along
four times or more and the BPM follows you; the pulse re-phases on every tap, so the
metronome lands on the beat you just played and you can see it settle.

The tempo is the average over the whole run, not the gap between the last two taps, so one
late tap nudges it instead of throwing it. A tap more than 35% off the running average is
not treated as a slip but as you deciding on a different tempo, so the count starts again
from those two taps rather than crawling to the new tempo over eight. Leave it alone for
2.4s and the run ends — the next tap is a fresh count-in. Measured: taps at exactly 500ms
give 120, at 667ms give 90, human jitter of ±35ms around 500ms gives 123, and switching
mid-run from 500ms to 800ms lands on 75. One write to disk when the tapping stops, not one
per tap. It is not in gig mode.

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
**Start** opens the first song in gig mode and `‹` `›` walk the running order; the song
title in the gig bar reads *At Last  2/20* and tapping it drops down the running order to
jump to any song in it. Setlists hold ids, not
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
region, an attachment, an mp3, a link, or a tempo or time signature moved off the
default all make a song worth keeping. A wrong "not empty" costs one stray
row; a wrong "empty" would lose work.

The ones already in the account are cleared up deliberately, never
automatically: the Songs tab offers **Remove _n_ empty** when there are any,
and the song you have open is always spared.

## Resources

Under the mp3 row, folded shut until you ask for it. It holds the things about a song
that are not the chart.

**Links** — paste a URL to a video or a recording. The service is named from the URL
alone, with no network call, so pasting works offline even though playing will not.

| Plays inside the app | Opens outside it |
|---|---|
| YouTube, Spotify, Apple Music, TIDAL, SoundCloud | Amazon Music, Bandcamp, Deezer, anything else |

Amazon Music publishes no embed at all, and Bandcamp's player wants a numeric album id
the public URL never shows — so those open out rather than pretending. The dialog says
which of the two you are getting **before** you save, and says that Spotify and Apple
Music hand you a preview unless that browser is signed in to them.

A link is text, so it rides in the song row: it syncs and backs up with no upload and
costs nothing in the offline audit. It is also the **one thing in the app that needs
signal**, which is why no link appears in gig mode and why opening one with no signal
says so instead of showing an empty frame.

Whether the panel is open is a **per-device** preference, not part of the song — folding
it must never restamp a song and push a sync.

### Sheet music

Attach a PDF or a photograph of the page in **Resources**. It is read inside the app —
pages rendered to canvas, fit to the width, pinch-free zoom buttons, page counter — and
**SCORE** on the gig screen opens it.

This is why `vendor/pdf.min.js` is in the repo. A PDF in an `<iframe>` shows page one and
nothing else on iOS, reliably, so a multi-page score needs a real renderer. It is vendored
as plain files (no build step, per the rule above), loaded the first time a score is opened
rather than at boot, and precached by the service worker — a score you cannot open in a
room with no signal is not a score you can play from. It costs about 1.3 MB of cache.

Pages are drawn at the device pixel ratio, so a stave is sharp rather than an upscale. A
zoom press while the first pass is still drawing used to throw: pdf.js refuses two renders
on one canvas. A new draw now cancels what is in flight and waits for it to settle first.

### Lyrics

Paste the whole sheet once, off the web, exactly as it comes. Then **Fit lyrics to bars**
walks the song: the sheet on one side with a cursor on the next unused word, the chart on
the other with one bar ringed. Tap words to extend the selection, **Place** puts them on
that bar and moves both on, **Skip** leaves a bar blank, **Back** undoes one. Nothing is
guessed and nothing is typed twice.

Words already used are **underlined, not greyed out** — a region marked ×2 needs the same
words a second time, so tapping one takes the cursor back to it and hands it out again.

What is stored on a bar is not a copy of the words but a **cut** — a from/to pair pointing
into the one pasted text. That is what lets the column on stage light the exact line being
sung, and it is why a region marked ×2 can hold different words each time through: a cut
carries which pass it belongs to. The walk hands you a ×N region's bars N times.

Every lyric typed by hand before any of this still shows: a bar with no cut falls back to
the string it always had. Typing in a bar that does have one is treated as deliberate — it
takes that bar back off the sheet rather than being overwritten on the next render.

Edit the pasted sheet and the cuts are re-found in one forward pass, because they were made
in order. A cut whose words are gone from the new sheet is **written back onto its bar as
typed text**, never dropped — the bar is unlinked from the sheet, not emptied.

**Lyrics** in the top bar opens the sheet beside the chart while you work, and carries
**Fit to bars** in its header — which is where you start from, not a button folded away
inside Resources. On stage, **LYRICS** in the gig bar shows the same thing. It costs the chart
250px while it is open, which is why it is a button and not a fixture, and the choice is
remembered per device. On a phone there is no room to share, so the column covers the
chart and you flip between them.

**Nothing in that column moves.** An earlier version lit the line being sung and followed
the playhead. That is wrong for a band playing to no click: the moment you stretch a bar,
the chart is confidently telling you where it *thinks* you are, which is worse than saying
nothing. So the column is a chord sheet — each bar's chord sitting on the words it lands
on, in playing order, all of it visible at once. It is equally true whether you are ahead
of the app or behind it.

A region played more than once gets a heading per pass (“1st time”, “2nd time”), so two
sets of words over the same bars stay told apart. Anything the walk has not reached yet is
still printed, without chords, under “Not fitted yet” — half a fitted song must not hide
the other half of the words.

### Cues

A cue is a pointer above the bars — “vocal starts”, “sustain”, “everyone out”. It is added
from the **block** it belongs to, which already knows its own bar number, rather than from
the region menu where you had to name that number by hand. The slot under a chord now
carries lyrics, so the cue lane above is where the rest of the marks go.

### A resources folder on the device

In the account dialog. Pick a folder and every file you attach is written into it as a real
file you can open in Finder — named `<song> — <file>`, with anything a filesystem refuses
stripped out. Change the folder later and you are asked whether to bring the files across;
**declining is a real answer**, and leaves you with two folders holding different material.

It is a **mirror, never the store of record.** IndexedDB stays that, because IndexedDB is
what makes the iPad open a chart with no signal, and no part of the stage path moves onto an
API the stage device does not have.

And it does not have it. `showDirectoryPicker` exists in Chrome and Edge on a desktop and in
**no browser on iPadOS** — every browser there is WebKit, so installing another one changes
nothing. Checked against MDN's compat data, not remembered:

| API | Chrome / Edge desktop | Safari macOS | Safari iOS & iPadOS |
|---|---|---|---|
| `showDirectoryPicker()` | 86 | no | **no** |
| `<input webkitdirectory>` | 7 | 11.1 | 18.4 |
| `storage.persist()` | 55 | 15.2 | 15.2 |

So on an iPad the panel says that plainly instead of offering a control that does nothing,
and gives the two things WebKit does allow: **Import from a folder**, which reads one in a
single shot (iPadOS 18.4+), and **Keep my files**, which asks iOS to stop treating them as
cache it may drop.

Because the browser forgets a folder permission when it restarts, the panel shows
**Reconnect** rather than failing silently — re-granting needs a click.

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
