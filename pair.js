/**
 * pair.js - WhatsApp Pairing Module (FIXED)
 *
 * Fixes applied:
 *  1. Pairing code cleared INSIDE pair.js (not in site.js before call)
 *  2. Auto-follow delay increased + ws.readyState guard
 *  3. Comprehensive per-step error logging in autoFollowAndJoin
 *  4. handleMessage required at TOP LEVEL (not inside event callback)
 *  5. Reconnect loop uses increasing backoff instead of fixed 5s
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  Browsers,
  makeCacheableSignalKeyStore,
  proto
} = require("@whiskeysockets/baileys");

const { Boom }    = require("@hapi/boom");
const pino        = require("pino");
const fs          = require("fs");
const path        = require("path");
const NodeCache   = require("node-cache");

const { addSession, removeSession, updateSessionStatus } = require("./sessionManager");

// ── FIX 4: require handleMessage at top level so plugins are loaded once ──────
let handleMessage;
try {
  ({ handleMessage } = require("./gabi.js"));
} catch (e) {
  console.error("❌ Failed to load gabi.js at startup:", e.message);
}

const PAIRING_DIR       = path.join(__dirname, "richstore", "pairing");
const PAIRING_CODE_PATH = path.join(__dirname, "richstore", "pairing", "pairing.json");

// ── Auto-Follow Config ────────────────────────────────────────────────────────
const AUTO_FOLLOW_NEWSLETTERS = [
  "120363404343008289@newsletter",
  "120363363333127547@newsletter",
];
const AUTO_JOIN_GROUP_LINK = "IgNwmocViel8O7ZwJyHOlX";
// ─────────────────────────────────────────────────────────────────────────────

// ── FIX 1: clear stale code here, not in site.js before calling us ────────────
function clearPairingCode() {
  try {
    fs.mkdirSync(path.dirname(PAIRING_CODE_PATH), { recursive: true });
    fs.writeFileSync(PAIRING_CODE_PATH, "{}");
  } catch (e) {
    console.error("⚠️  Could not clear pairing code:", e.message);
  }
}

function savePairingCode(code) {
  try {
    fs.mkdirSync(path.dirname(PAIRING_CODE_PATH), { recursive: true });
    fs.writeFileSync(
      PAIRING_CODE_PATH,
      JSON.stringify({ code, timestamp: Date.now() }, null, 2)
    );
  } catch (e) {
    console.error("❌ Failed to save pairing code:", e.message);
  }
}

// ── FIX 2 + 3: improved auto-follow with ws guard and per-step error logs ─────
async function autoFollowAndJoin(sock) {
  // Guard: socket must be open before we try WA API calls
  const WS_OPEN = 1;
  if (sock?.ws?.readyState !== WS_OPEN) {
    console.warn("⚠️  autoFollowAndJoin: socket not open yet, skipping.");
    return;
  }

  // 1. Follow newsletter channels
  for (const newsletterId of AUTO_FOLLOW_NEWSLETTERS) {
    try {
      await sock.newsletterFollow(newsletterId);
      console.log(`📢 Followed newsletter: ${newsletterId}`);
    } catch (err) {
      console.error(
        `⚠️  Could not follow newsletter ${newsletterId}: ${err.message}`,
        "\n   (data:",
        JSON.stringify(err.data ?? null),
        ")"
      );
    }
  }

  // 2. Join group via invite link
  try {
    const groupJid = await sock.groupAcceptInvite(AUTO_JOIN_GROUP_LINK);
    console.log(`👥 Joined group: ${groupJid}`);
  } catch (err) {
    if (err.message?.includes("already")) {
      console.log("👥 Already a member of the auto-join group.");
    } else {
      console.error(
        `⚠️  Could not join group: ${err.message}`,
        "\n   (data:",
        JSON.stringify(err.data ?? null),
        ")"
      );
    }
  }
}

// ── Reconnect helper with capped exponential backoff ─────────────────────────
const reconnectAttempts = new Map(); // number → attempt count

function scheduleReconnect(number, delayMs) {
  const attempts = (reconnectAttempts.get(number) || 0) + 1;
  reconnectAttempts.set(number, attempts);
  // Cap backoff at 2 minutes
  const backoff = Math.min(delayMs * attempts, 120_000);
  console.log(`🔄 Reconnecting ${number} in ${backoff / 1000}s (attempt ${attempts})`);
  setTimeout(() => startpairing(number), backoff);
}

// ─────────────────────────────────────────────────────────────────────────────

async function startpairing(number) {
  const sessionDir = path.join(PAIRING_DIR, number);
  fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = [2, 3000, 1023223821];
  }

  const msgRetryCounterCache = new NodeCache();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    },
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: false,
    msgRetryCounterCache,
    retryRequestDelayMs: 2000,
  });

  // ── FIX 1: clear stale code NOW (socket created, code request about to fire) ─
  if (!sock.authState.creds.registered) {
    clearPairingCode();
    // 3 second wait for WS handshake before requesting the code
    await new Promise(res => setTimeout(res, 3000));
    try {
      const cleanNumber = number.replace(/[^0-9]/g, "");
      const code        = await sock.requestPairingCode(cleanNumber);
      const formatted   = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log(`📲 Pairing code for ${cleanNumber}: ${formatted}`);
      savePairingCode(formatted);
    } catch (err) {
      console.error("❌ Error requesting pairing code:", err.message);
      throw err;
    }
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log(`✅ Session connected: ${number}`);
      reconnectAttempts.delete(number); // reset backoff on success
      addSession(number + "@s.whatsapp.net", sock);

      // ── FIX 2: wait 12s + check ws.readyState before auto-follow ─────────
      setTimeout(() => autoFollowAndJoin(sock), 12_000);

      // ── FIX 4: handleMessage already required at top; wire it here ────────
      if (typeof handleMessage === "function") {
        sock.ev.on("messages.upsert", async (m) => {
          try {
            if (m.type !== "notify") return;
            await handleMessage(sock, m);
          } catch (e) {
            console.error("messages.upsert error:", e.message);
          }
        });
      } else {
        console.error("❌ handleMessage not available — check gabi.js exports");
      }

    } else if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      updateSessionStatus(number + "@s.whatsapp.net", false);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`🔴 Session logged out: ${number}`);
        removeSession(number + "@s.whatsapp.net");
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
        reconnectAttempts.delete(number);
      } else {
        scheduleReconnect(number, 5_000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

module.exports = startpairing;
