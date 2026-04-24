# Gabimaru Bot — Fix Summary

## Files changed

| File | What changed |
|------|-------------|
| `pair.js` | Bugs 1–4 fixed (see below) |
| `site.js` | Bug 1 counter-fix — premature wipe removed |
| `gabi-plugins/menu.js` | Redesigned: status-panel style + ad-reply format |
| `ecosystem.config.js` | Pterodactyl-safe PM2 config |
| `nginx.conf` | **NEW** — reverse proxy for Pterodactyl external access |

---

## Bug fixes

### Bug 1 — Pairing code wiped before it's written (site.js line ~152)
**Root cause:** `site.js` wrote `{}` to `pairing.json` *before* calling
`startpairing()`.  `pair.js` then waits 3 s before requesting the code, so the
frontend polling `/pairing-code` would see `{}` even after the code was generated
if the previous session's code was valid.

**Fix:** Removed the wipe from `site.js`.  `pair.js` now calls `clearPairingCode()`
itself, *right before* calling `sock.requestPairingCode()` — only if the number
isn't already registered.  The wipe and the write are now atomic from the
frontend's perspective.

---

### Bug 2 — Auto-follow fires before socket is ready (pair.js line ~128)
**Root cause:** `setTimeout(() => autoFollowAndJoin(sock), 5000)` fired 5 s after
`connection === 'open'`, but on slow connections the WS handshake with WhatsApp
servers (after `open`) isn't fully settled that quickly, so newsletter/group API
calls silently failed.

**Fix:**
1. Delay increased to **12 000 ms**.
2. Added a `ws.readyState === WebSocket.OPEN (1)` guard inside
   `autoFollowAndJoin` — if the socket has closed between the event and the
   timer firing, the function exits early instead of throwing.

---

### Bug 3 — Auto-follow errors were swallowed silently
**Root cause:** Each `try/catch` block only logged `err.message`; the extra
`err.data` field (which Baileys puts on most API errors) was discarded.

**Fix:** Both the newsletter-follow loop and the group-join block now also log
`err.data` (JSON-serialised) so you can see the exact WA error code.

---

### Bug 4 — `handleMessage` required inside the event callback
**Root cause:** `const { handleMessage } = require("./gabi.js")` was called
*inside* `connection === 'open'`, which means:
- First connection: plugins load fine via `gabi.js`'s top-level `loadPlugins()`.
- If the session reconnects, `require` returns the cached module — plugins are
  not reloaded but `handleMessage` is still wired, so this is mostly fine.
- **The real failure:** if `gabi.js` itself throws on first load (e.g. a bad
  plugin syntax error), the error is swallowed inside the event handler and you
  get no log.  The bot connects but ignores all messages.

**Fix:** `handleMessage` is now required at **top level** of `pair.js`, before
any socket is created.  Load errors surface immediately at startup.  The event
handler checks `typeof handleMessage === 'function'` and logs an explicit error
if it's missing.

---

### Bug 5 — No reverse proxy for Pterodactyl
**Fix:** Added `nginx.conf` with full instructions.

Steps:
1. Replace `YOUR_DOMAIN` and `CONTAINER_IP` in the file.
2. `sudo cp nginx.conf /etc/nginx/sites-available/gabimaru`
3. `sudo ln -s /etc/nginx/sites-available/gabimaru /etc/nginx/sites-enabled/`
4. `sudo nginx -t && sudo systemctl reload nginx`
5. Optional SSL: `sudo certbot --nginx -d YOUR_DOMAIN`

---

## Menu redesign

The `menu` command now sends two messages:

1. **Status panel** — same `╔══/║/╚══` bordered format as `status.js`, showing
   bot name, prefix, mode, plugin count, uptime, RAM, CPU.  Delivered as an
   `externalAdReply` card (the WhatsApp ad-preview style with thumbnail + title).

2. **Tappable command list** — WhatsApp list message, one section per category.
   Each row shows `<prefix><command>` as the title and the plugin's description
   as the subtitle.  Tapping a row sends that command automatically.

---

## How to deploy

### Heroku
No change needed — `Procfile` (`web: node site.js`) works as-is.

### Pterodactyl
Set the startup command to:
```
pm2-runtime start ecosystem.config.js
```
Make sure `pm2` is installed globally:
```
npm install -g pm2
```
Then expose the port via the nginx proxy (see `nginx.conf`).
