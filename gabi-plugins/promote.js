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
  command: ["promote"],
  description: "Promote a user to group admin",
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
        text: `⚠️ Reply to or @mention the user you want to promote.\nUsage: \`${prefix}promote @user\``
      }, { quoted: msg });
    }

    const targetNum = target.split("@")[0];

    try {
      await sock.groupParticipantsUpdate(from, [target], "promote");

      // ── Style 5 — Promotion card ───────────────────────────────────────────
      await sock.sendMessage(from, {
        text: `🌟 *Promoted to Admin*\n\n@${targetNum} has been granted admin privileges.\n\n▸ Can now manage members\n▸ Can kick, mute, and promote\n▸ Has full group control`,
        mentions: [target],
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            renderLargerThumbnail: false,
            title: `@${targetNum} — Promoted 🌟`,
            body: "New group admin added",
            previewType: "PHOTO",
            thumbnailUrl: BANNER_URL,
            sourceUrl: GITHUB_URL,
            mediaUrl:  GITHUB_URL,
            mediaType: 1
          }
        }
      }, { quoted: fakeQuote(from) });

    } catch (err) {
      console.error("Promote error:", err);
      await sock.sendMessage(from, {
        text: `❌ Failed to promote @${targetNum}. Ensure I have admin rights.`,
        mentions: [target]
      }, { quoted: msg });
    }
  }
};
