# AGENTS.md — Song Structure

Omkar plays gigs off this app. It is a stage tool, not a demo: it has to work with no
signal, on an iPad, with a plectrum in hand, and it must never lose a song.

---

## 1. Verify before you claim. Every time.

**Nothing is "done" until you have watched it work.** Not "the code looks right", not "the
edit applied cleanly", not "tests would pass". You looked at it, or it is not done.

After **every** change to the app, before saying a word about it:

1. **Bump the asset version.** `?v=YYYYMMDD-N` in `index.html` (all six tags) *and*
   `const V` in `sw.js`. They must match. GitHub Pages and the service worker both cache;
   an un-bumped deploy is an invisible deploy, and a stale `cloud.js` against a fresh
   `app.js` fails in ways that look like logic bugs.
2. **`node --check`** every file you touched (`app.js`, `cloud.js`, `sw.js`, `icons.js`,
   `db.js`).
3. **Run it and look at it.** Serve locally, open the browser pane, and *take a screenshot*
   of the thing you changed. Reading the DOM is not enough on its own — layout bugs
   (overlaps, clipping, things covering the chord you are trying to type) only show up in
   a picture.
4. **Measure the claim.** If you say "the tools no longer cover the chord", read the two
   `getBoundingClientRect()`s and show they do not intersect. If you say "it fits", compare
   `scrollWidth` to `clientWidth`. Assertions beat adjectives.
5. **Check the device classes you affected**, at minimum:
   - desktop (pointer, hover)
   - iPad portrait **834×1112** and landscape **1180×820**
   - phone **375×812**
   - light **and** dark
6. **Exercise the touch path properly.** The pane only emulates touch below 768px wide.
   To test touch rules at iPad size, activate the shipped media query rather than retyping
   the rules:
   ```js
   for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules } catch (e) { continue }
     for (const r of rs) if (r.type === 4 && /hover:\s*none/.test(r.conditionText || '')) r.media.mediaText = 'all' }
   ```
7. **Deploy, then prove the deploy.** Push, poll until the new version is live, and confirm
   the live file really contains the new code:
   ```bash
   curl -s https://omkar9214.github.io/song-structure/app.js?v=<new> | grep -c "<new function>"
   ```
8. **Say what you did not verify.** Print output, real iPad hardware, iOS Safari specifics —
   name them. A hedge in the right place buys trust; a false "verified" burns it.

### Screenshots are the evidence
Take them of the state you are claiming, after the state change, and take a second one if
the pane looks stale — it lags a repaint behind the DOM more often than you would like.

---

## 2. Never lose his data

- He has **21+ real songs** in this account. Read-only operations on his live browser are
  fine; writes are not, unless he asked for them. If a test needs data, seed it in the
  Browser pane (a sandbox that is **not** signed in), never in his signed-in Chrome.
- If a test does write to his account (proving a sync path, say), **undo it** and verify
  the undo by reading the row back.
- `migrate()` runs on every load. It may add fields. It may never drop a song.
- Anything that merges remote state must be able to survive a stale device (see §4).

---

## 3. Local-first is the whole point

Vanilla HTML/CSS/JS. **No build step, no framework, no bundler.** He opens this at gigs;
it has to be a file that loads. shadcn/React/Tailwind were considered and rejected.

- The app must work with **no network**. The cloud is a layer, never a requirement.
- `localStorage` holds the state; IndexedDB (`db.js`) holds media blobs.
- No `prompt()` / `confirm()` — blocked in embedded browsers. Use the dialogs.
- No dialog `close` events — they do not fire everywhere. Every dialog button gets its own
  handler.
- Supabase auth is **implicit flow, not PKCE**: the sign-in link opens in a different
  browser from the one that asked for it.
- A top-level `const` is **not** a property of `window`. If something must be reachable as
  `window.X`, assign it explicitly (this cost us silent, total sync failure once).

---

## 4. Sync rules

The `songs` table is `(owner, id, data jsonb, updated_at)`. One row per song, plus one row
`__setlists` carrying the setlists (no second table — he is not running SQL before a gig).

- Reconciliation is **per song, against a per-device base stamp** (`state.syncBase`), not a
  naive newest-wins: if both sides changed since the base, the local copy stays live and the
  other device's version is kept as a separate song. **Nothing is ever silently discarded.**
- Anything that writes setlists goes through `saveLists()`, never `save()` — editing a
  setlist must not restamp the open song.
- Never invent a timestamp for something pulled from the server; a made-up stamp outranks it.

---

## 5. Stage-first UI rules

- **Cues are always visible.** Anything you can only see by hovering does not exist on stage.
- **Gig mode is read-only by construction** — a separate rendering with no inputs at all, not
  the editor with controls hidden. If you add a control to it, ask whether a sleeve can hit it.
- **Touch: nothing opens by itself.** Safari fires `:hover` on a tap. `⋯` opens the action
  sheet; that is the only way tools appear on touch. There is **no drag handle on touch** —
  it sat over the chord and a tap on it started a drag; reordering is a labelled row in the
  sheet.
- **Themes come in three:** System, Light, Dark (`data-theme` on `<html>`, remembered per
  device). The dark tokens exist twice in `app.css` — once under `prefers-color-scheme` for
  the system setting, once under `[data-theme="dark"]` for his choice. **Edit one, edit the
  other.**
- **16px minimum for anything typeable on touch** — below that iOS zooms the page on focus
  and does not zoom back out.
- **~40px minimum tap targets** on touch.
- Icons are SVG (`icons.js`), never emoji. Emoji appear only as user-chosen cue markers.
- Every icon-only control needs `aria-label` and `data-tip`.

---

## 6. Things he has already rejected — do not re-propose

- shadcn / Tailwind / React, and any build step
- The `--design-system` "Hero-Centric" palette
- Emoji as UI icons
- `columns` icon for clips ("it shows like a book") — clips use the waveform
- Repeating the region strip on wrapped rows with "cont."
- Stats pills: bars written/played, runtime

---

## 7. Deploy

```bash
git add -A && git commit && git push origin main    # main is the Pages branch
```
Then poll until live and verify the content, per §1.7. Local dev server:

```bash
python3 -m http.server 8712
```

The browser caches `index.html` for ten minutes on Pages; the service worker revalidates it,
but when testing locally add a cache-busting query (`?bust=N`) or you will test old bytes and
believe old results.
