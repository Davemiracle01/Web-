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
  command: ["demote"],
  description: "Demote a group admin to regular member",
  isGroup: true,
  isAdmin: true,

  async run({ sock, msg, from, settings }) {
    await react01(sock, from, msg.key, 1000);

    const quotedInfo   = msg.message.extendedTextMessage?.contextInfo;
    const mentionedJid = quotedInfo?.mentionedJid?.[0];
    const repliedToJid = quotedInfo?.participant;
    const target       = mentionedJid || repliedToJid;
    const prefix       = settings.prefix;

    if (!target) {
      return sock.sendMessage(from, {
        text: `⚠️ Reply to or @mention the admin you want to demote.\nUsage: \`${prefix}demote @user\``
      }, { quoted: msg });
    }

    const targetNum = target.split("@")[0];

    try {
      await sock.groupParticipantsUpdate(from, [target], "demote");

      // ── Style 5 — Demotion card ────────────────────────────────────────────
      await sock.sendMessage(from, {
        text: `📉 *Demoted from Admin*\n\n@${targetNum} has been removed from the admin list.\n\n▸ Now a regular member\n▸ No longer has admin privileges`,
        mentions: [target],
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            renderLargerThumbnail: false,
            title: `@${targetNum} — Demoted 📉`,
            body: "Admin privileges removed",
            previewType: "PHOTO",
            thumbnailUrl: BANNER_URL,
            sourceUrl: GITHUB_URL,
            mediaUrl:  GITHUB_URL,
            mediaType: 1
          }
        }
      }, { quoted: fakeQuote(from) });

    } catch (err) {
      console.error("Demote error:", err);
      await sock.sendMessage(from, {
        text: `❌ Failed to demote @${targetNum}. Ensure I have admin rights.`,
        mentions: [target]
      }, { quoted: msg });
    }
  }
};
