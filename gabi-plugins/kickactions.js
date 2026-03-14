const { react01 } = require('../lib/extra');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🛡️ Admin Action" }
  };
}

module.exports = {
  command: ["kickconfirm", "warnkick", "kickannounce"],
  description: "Execute kick actions (used by kick action picker)",
  isGroup: true,
  isAdmin: true,

  async run({ sock, msg, from, commandName, args, text }) {
    await react01(sock, from, msg.key, 1000);

    // Target is passed as the first argument (full JID)
    const target = args[0] || text?.trim();
    if (!target || !target.includes("@")) {
      return sock.sendMessage(from, { text: "⚠️ Invalid target." }, { quoted: msg });
    }

    const targetNum = target.split("@")[0];

    // ── Warn + kick ────────────────────────────────────────────────────────────
    if (commandName === "warnkick") {
      await sock.sendMessage(from, {
        text: `⚠️ *Final Warning*\n\n@${targetNum}, this is your last warning before removal from this group. Comply with the rules or be removed.`,
        mentions: [target]
      }, { quoted: msg });

      await new Promise(r => setTimeout(r, 3000));
    }

    // ── Kick ──────────────────────────────────────────────────────────────────
    try {
      await sock.groupParticipantsUpdate(from, [target], "remove");

      const announceText = commandName === "kickannounce"
        ? `📢 *Member Removed*\n\n@${targetNum} has been removed from the group by an admin.\n\n_If you believe this was a mistake, contact an admin._`
        : `✅ @${targetNum} has been removed.`;

      // ── Style 5 — Result card ───────────────────────────────────────────────
      await sock.sendMessage(from, {
        text: announceText,
        mentions: [target],
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            renderLargerThumbnail: false,
            title: "Member Removed 🛡️",
            body: `@${targetNum} was kicked from the group`,
            previewType: "PHOTO",
            thumbnailUrl: BANNER_URL,
            sourceUrl: GITHUB_URL,
            mediaUrl:  GITHUB_URL,
            mediaType: 1
          }
        }
      }, { quoted: fakeQuote(from) });

    } catch (err) {
      console.error("Kick error:", err);
      await sock.sendMessage(from, {
        text: `❌ Failed to kick @${targetNum}. Make sure I'm an admin with proper permissions.`,
        mentions: [target]
      }, { quoted: msg });
    }
  }
};
