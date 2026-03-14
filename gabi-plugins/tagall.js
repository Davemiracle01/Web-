const { react01 } = require('../lib/extra');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "📢 Tag All" }
  };
}

module.exports = {
  command: ["tagall", "everyone", "all"],
  description: "Mention all group members with announcement types",
  isGroup: true,
  isSudo: true,

  async run({ sock, msg, from, text, settings }) {
    await react01(sock, from, msg.key, 1000);

    const metadata     = await sock.groupMetadata(from);
    const participants = metadata.participants || [];
    const gcName       = metadata.subject || "Group";
    const gcCount      = participants.length;
    const mentions     = participants.map(p => p.id);
    const memberList   = participants.map((p, i) => `${i + 1}. @${p.id.split("@")[0]}`).join("\n");
    const prefix       = settings.prefix;

    // If user passed custom text — tag directly without showing the list menu
    if (text && text.trim()) {
      await sock.sendMessage(from, {
        text: `📢 *${text.trim()}*\n\n${memberList}`,
        mentions
      }, { quoted: fakeQuote(from) });
      return;
    }

    // ── Style 3 — Announcement type picker ──────────────────────────────────
    const sections = [
      {
        title: "📢 Announcements",
        rows: [
          { title: "📌 General Announcement",  rowId: `${prefix}tagall 📌 Attention everyone! Read this message.`,      description: "Tag all with a general notice" },
          { title: "⚠️ Important Alert",        rowId: `${prefix}tagall ⚠️ IMPORTANT! Please read this carefully.`,       description: "Urgent alert to all members" },
          { title: "🎉 Event / Celebration",    rowId: `${prefix}tagall 🎉 Exciting news for the group!`,                 description: "Share exciting group news" },
          { title: "📋 Meeting / Reminder",     rowId: `${prefix}tagall 📋 Reminder: Check the group updates.`,           description: "Remind everyone of something" },
        ]
      },
      {
        title: "🛡️ Admin Actions",
        rows: [
          { title: "🔕 Warning to Members",    rowId: `${prefix}tagall 🔕 Warning: Please follow the group rules.`,      description: "Issue a group warning" },
          { title: "📵 Rule Reminder",          rowId: `${prefix}tagall 📵 Rules reminder: No spam, no links, be civil.`, description: "Re-share group rules" },
          { title: "✅ Activity Check",         rowId: `${prefix}tagall ✅ Activity check — reply if you're active!`,      description: "Check who is active" },
        ]
      }
    ];

    // ── Style 5 — Banner showing group info ────────────────────────────────────
    await sock.sendMessage(from, {
      text: `👥 *Tag All — ${gcName}*\n\n▸ Members: *${gcCount}*\n\nPick an announcement type from the list, or use:\n\`${prefix}tagall your custom message\``,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: `Tag All — ${gcName}`,
          body: `${gcCount} members will be mentioned`,
          previewType: "PHOTO",
          thumbnailUrl: BANNER_URL,
          sourceUrl: GITHUB_URL,
          mediaUrl:  GITHUB_URL,
          mediaType: 1
        }
      }
    }, { quoted: fakeQuote(from) });

    await sock.sendMessage(from, {
      text: `*Select Announcement Type*\n\nTapping a row sends the command automatically and tags all ${gcCount} members.\n\n_Or type_ \`${prefix}tagall <your message>\` _for custom text._`,
      footer: `${gcName}  •  ${gcCount} members`,
      title: "📢 Tag Everyone",
      buttonText: "🔽  Choose Type",
      sections,
      listType: 1
    }, { quoted: msg });
  }
};
