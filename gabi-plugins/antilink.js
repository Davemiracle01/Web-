const fs = require('fs');
const path = require('path');
const { react01 } = require('../lib/extra');

const antiLinkPath = path.join(__dirname, '../antilink.json');

const BLOCKED_LINKS = [
  "https://",
  "http://",
  "www.",
  "wa.me",
  "chat.whatsapp.com",
  "t.me",
  "discord.gg",
  "discord.com/invite",
  "bit.ly",
  "tinyurl.com",
  "youtu.be",
  "youtube.com",
  "fb.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com"
];

function loadDB() {
  return fs.existsSync(antiLinkPath)
    ? JSON.parse(fs.readFileSync(antiLinkPath, 'utf8'))
    : {};
}

function saveDB(db) {
  fs.writeFileSync(antiLinkPath, JSON.stringify(db, null, 2));
}

module.exports = [
  // ── Toggle Command ──────────────────────────────────────────────
  {
    command: ["antilink"],
    description: "Toggle anti-link on or off in a group",
    isGroup: true,
    isAdmin: true,

    async run({ msg, sock, from, args }) {
      const toggle = args[0]?.toLowerCase();

      if (!toggle || !["on", "off"].includes(toggle)) {
        return sock.sendMessage(from, {
          text: "⚙️ Usage: .antilink on | off"
        }, { quoted: msg });
      }

      const db = loadDB();

      if (toggle === "on") {
        db[from] = true;
      } else {
        delete db[from];
      }

      saveDB(db);
      await react01(sock, from, msg.key, 2000);
      await sock.sendMessage(from, {
        text: `🚫 Anti-link is now *${toggle.toUpperCase()}* for this group.`
      }, { quoted: msg });
    }
  },

  // ── Message Handler ─────────────────────────────────────────────
  {
    command: ["__antilink_handler"],
    description: "Enforces anti-link in active groups",
    isGroup: true,
    on: "message",

    async run({ msg, sock, from }) {
      const db = loadDB();
      if (!db[from]) return;

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption || "";

      if (!text) return;

      const hasLink = BLOCKED_LINKS.some(link =>
        text.toLowerCase().includes(link)
      );
      if (!hasLink) return;

      const sender = msg.key.participant || msg.key.remoteJid;
      const senderNum = sender.split("@")[0];

      // Delete the message first
      await sock.chatModify({ delete: true }, from, [msg.key]);

      // Warn the sender
      await sock.sendMessage(from, {
        text: `🚫 *Link detected and removed.*\n\n▸ User: @${senderNum}\n▸ Links are not permitted in this group.`,
        mentions: [sender]
      }, { quoted: msg });

      await react01(sock, from, msg.key, 1000);
    }
  }
];
