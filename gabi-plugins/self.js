const { react01 } = require('../lib/extra');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "⚙️ Bot Mode" }
  };
}

module.exports = {
  command: ["self"],
  description: "Set bot to self mode (owner/sudo only)",
  isSudo: true,

  async run({ msg, sock, from, settings }) {
    await react01(sock, from, msg.key, 1000);
    sock.public = false;

    const botName = settings.botName || settings.packname || "Gabimaru";
    const prefix  = settings.prefix;

    // ── Style 5 — Mode confirmation card ──────────────────────────────────────
    await sock.sendMessage(from, {
      text: `🔒 *Self Mode Activated*\n\n${botName} now responds *only to owners and sudo users*.\n\n▸ Status: 🔒 Self\n▸ To open to everyone: \`${prefix}public\``,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: `${botName} — Now Private 🔒`,
          body: "Only owners & sudo users can use commands",
          previewType: "PHOTO",
          thumbnailUrl: BANNER_URL,
          sourceUrl: GITHUB_URL,
          mediaUrl:  GITHUB_URL,
          mediaType: 1
        }
      }
    }, { quoted: fakeQuote(from) });

    // ── Style 3 — Quick mode options ───────────────────────────────────────────
    await sock.sendMessage(from, {
      text: `*Mode Changed → Self*\n\nQuick actions:`,
      footer: `${botName}  •  mode panel`,
      title: "⚙️ Bot Mode",
      buttonText: "🔽  Mode Options",
      sections: [{
        title: "⚙️ Bot Mode",
        rows: [
          { title: "🌐 Switch to Public Mode", rowId: `${prefix}public`,   description: "Let everyone use the bot" },
          { title: "👑 Manage Sudo Users",     rowId: `${prefix}listsudo`, description: "Add/remove sudo users" },
          { title: "📋 Open Menu",             rowId: `${prefix}menu`,     description: "Browse all commands" },
        ]
      }],
      listType: 1
    }, { quoted: msg });
  }
};
