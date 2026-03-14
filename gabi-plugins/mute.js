const { react01 } = require('../lib/extra');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🛡️ Group Settings" }
  };
}

module.exports = {
  command: ["mute", "unmute"],
  description: "Mute or unmute the group",
  isGroup: true,
  isAdmin: true,

  async run({ sock, msg, from, commandName, settings }) {
    await react01(sock, from, msg.key, 1000);

    const isMuting = commandName === "mute";
    const prefix   = settings.prefix;

    try {
      await sock.groupSettingUpdate(from, isMuting ? "announcement" : "not_announcement");

      // ── Style 5 — Setting change card ─────────────────────────────────────
      await sock.sendMessage(from, {
        text: isMuting
          ? `🔇 *Group Muted*\n\nOnly admins can send messages now.\n\n▸ To unmute: \`${prefix}unmute\``
          : `🔊 *Group Unmuted*\n\nAll members can now send messages.\n\n▸ To mute again: \`${prefix}mute\``,
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            renderLargerThumbnail: false,
            title: isMuting ? "Group Muted 🔇" : "Group Unmuted 🔊",
            body: isMuting ? "Admins only" : "Everyone can send",
            previewType: "PHOTO",
            thumbnailUrl: BANNER_URL,
            sourceUrl: GITHUB_URL,
            mediaUrl:  GITHUB_URL,
            mediaType: 1
          }
        }
      }, { quoted: fakeQuote(from) });

    } catch (e) {
      console.error("Mute/Unmute error:", e);
      await sock.sendMessage(from, {
        text: `❌ Failed to ${isMuting ? "mute" : "unmute"} the group. Ensure I have admin rights.`
      }, { quoted: msg });
    }
  }
};
