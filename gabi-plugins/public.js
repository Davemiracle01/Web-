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
  command: ["public"],
  description: "Set bot to public mode (everyone can use commands)",
  isSudo: true,

  async run({ msg, sock, from, settings }) {
    await react01(sock, from, msg.key, 1000);
    sock.public = true;

    const botName = settings.botName || settings.packname || "Gabimaru";
    const prefix  = settings.prefix;

    // ── Style 5 — Mode confirmation card ──────────────────────────────────────
    await sock.sendMessage(from, {
      text: `🌐 *Public Mode Activated*\n\n${botName} will now respond to commands from *everyone*, not just owners.\n\n▸ Status: 🟢 Public\n▸ To revert: \`${prefix}self\``,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: `${botName} — Now Public 🌐`,
          body: "All users can now use bot commands",
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
      text: `*Mode Changed → Public*\n\nQuick actions:`,
      footer: `${botName}  •  mode panel`,
      title: "⚙️ Bot Mode",
      buttonText: "🔽  Mode Options",
      sections: [{
        title: "⚙️ Bot Mode",
        rows: [
          { title: "🔒 Switch to Self Mode",  rowId: `${prefix}self`,   description: "Restrict to owner/sudo only" },
          { title: "🏓 Check Speed",           rowId: `${prefix}ping`,   description: "Verify bot is responsive" },
          { title: "📋 Open Menu",             rowId: `${prefix}menu`,   description: "Browse all commands" },
        ]
      }],
      listType: 1
    }, { quoted: msg });
  }
};
