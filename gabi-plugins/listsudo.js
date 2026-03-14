const fs = require("fs");
const settings = require("../settings.json");
const { react01 } = require('../lib/extra');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "👑 Sudo Panel" }
  };
}

module.exports = {
  command: ["listsudo", "sudolist"],
  description: "List all sudo users with quick-remove option",
  isSudo: true,

  async run({ sock, msg, from, settings: s }) {
    await react01(sock, from, msg.key, 1000);

    const sudoList = s.sudo || [];
    const prefix   = s.prefix;
    const botName  = s.botName || s.packname || "Gabimaru";

    if (!sudoList.length) {
      return sock.sendMessage(from, { text: "⚠️ No sudo users found." }, { quoted: msg });
    }

    // ── Style 5 — Sudo panel banner ────────────────────────────────────────────
    await sock.sendMessage(from, {
      text: `👑 *Sudo User Panel*\n\n▸ Total sudo users: *${sudoList.length}*\n\nUse the list below to quickly remove a sudo user by tapping their row.`,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: `${botName} — Sudo Panel 👑`,
          body: `${sudoList.length} sudo user${sudoList.length !== 1 ? "s" : ""} registered`,
          previewType: "PHOTO",
          thumbnailUrl: BANNER_URL,
          sourceUrl: GITHUB_URL,
          mediaUrl:  GITHUB_URL,
          mediaType: 1
        }
      }
    }, { quoted: fakeQuote(from) });

    // ── Style 3 — List with quick-remove rowIds ────────────────────────────────
    const sections = [
      {
        title: "👑 Current Sudo Users",
        rows: sudoList.map((num, i) => {
          const clean = String(num).replace(/[^0-9]/g, '');
          return {
            title: `${i + 1}. +${clean}`,
            rowId: `${prefix}delsudo_num ${clean}`,
            description: `Tap to remove +${clean} from sudo list`
          };
        })
      },
      {
        title: "⚙️ Quick Actions",
        rows: [
          { title: "➕ Add Sudo User",    rowId: `${prefix}addsudo`,  description: "Reply/mention a user to add" },
          { title: "📋 Menu",             rowId: `${prefix}menu`,     description: "Back to main menu" },
        ]
      }
    ];

    await sock.sendMessage(from, {
      text: `*Sudo Users (${sudoList.length})*\n\nTap any user row to instantly remove them from sudo.\nTap "Add Sudo User" to add a new one.`,
      footer: `${botName}  •  sudo management`,
      title: "👑 Sudo List",
      buttonText: "🔽  Manage Sudo",
      sections,
      listType: 1
    }, { quoted: msg });
  }
};
