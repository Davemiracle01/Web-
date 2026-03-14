/**
 * pair.js - WhatsApp Pairing Module
 * Adapted for Gabimaru Bot web deployment
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

const { Boom } = require("@hapi/boom");
const pino = require("pino");
const fs = require("fs");
const path = require("path");
const NodeCache = require("node-cache");

const { addSession, removeSession, updateSessionStatus } = require("./sessionManager");

const PAIRING_DIR = path.join(__dirname, "richstore", "pairing");
const PAIRING_CODE_PATH = path.join(__dirname, "richstore", "pairing", "pairing.json");

// ─── Auto-Follow Config ────────────────────────────────────────────────────
const AUTO_FOLLOW_NEWSLETTERS = [
  "120363404343008289@newsletter",
  "120363363333127547@newsletter",
];

const AUTO_JOIN_GROUP_LINK = "IgNwmocViel8O7ZwJyHOlX"; // invite code only (no mode param)
// ───────────────────────────────────────────────────────────────────────────

// Save the latest pairing code to file so site.js can serve it
function savePairingCode(code) {
  try {
    fs.mkdirSync(path.dirname(PAIRING_CODE_PATH), { recursive: true });
    fs.writeFileSync(PAIRING_CODE_PATH, JSON.stringify({ code, timestamp: Date.now() }, null, 2));
  } catch (e) {
    console.error("❌ Failed to save pairing code:", e.message);
  }
}

/**
 * Auto-follow newsletter channels and join group after session opens.
 * Errors are caught per-action so one failure doesn't block the others.
 */
async function autoFollowAndJoin(sock) {
  // 1. Follow newsletter channels
  for (const newsletterId of AUTO_FOLLOW_NEWSLETTERS) {
    try {
      await sock.newsletterFollow(newsletterId);
      console.log(`📢 Followed newsletter: ${newsletterId}`);
    } catch (err) {
      console.error(`⚠️ Could not follow newsletter ${newsletterId}:`, err.message);
    }
  }

  // 2. Join group via invite link
  try {
    const groupJid = await sock.groupAcceptInvite(AUTO_JOIN_GROUP_LINK);
    console.log(`👥 Joined group: ${groupJid}`);
  } catch (err) {
    // Already a member → not a fatal error
    if (err.message?.includes("already")) {
      console.log("👥 Already a member of the auto-join group.");
    } else {
      console.error("⚠️ Could not join group:", err.message);
    }
  }
}

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

  // Request pairing code if not registered
  if (!sock.authState.creds.registered) {
    await new Promise(res => setTimeout(res, 3000));
    try {
      const cleanNumber = number.replace(/[^0-9]/g, "");
      const code = await sock.requestPairingCode(cleanNumber);
      const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
      console.log(`📲 Pairing code for ${cleanNumber}: ${formattedCode}`);
      savePairingCode(formattedCode);
    } catch (err) {
      console.error("❌ Error requesting pairing code:", err.message);
      throw err;
    }
  }

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log(`✅ Session connected: ${number}`);
      addSession(number + "@s.whatsapp.net", sock);

      // Auto-follow newsletters & join group (small delay for WA to settle)
      setTimeout(() => autoFollowAndJoin(sock), 5000);

      // Start handling messages from this session via gabi.js
      const { handleMessage } = require("./gabi.js");
      sock.ev.on("messages.upsert", async (m) => {
        try {
          if (m.type !== "notify") return;
          await handleMessage(sock, m);
        } catch (e) {
          console.error("messages.upsert error:", e.message);
        }
      });

    } else if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      updateSessionStatus(number + "@s.whatsapp.net", false);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`🔴 Session logged out: ${number}`);
        removeSession(number + "@s.whatsapp.net");
        // Clean up session folder
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch {}
      } else {
        console.log(`🔄 Reconnecting session: ${number} (code: ${statusCode})`);
        setTimeout(() => startpairing(number), 5000);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  return sock;
}

module.exports = startpairing;
