const { react01 } = require('../lib/extra');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🛡️ Admin Panel" }
  };
}

module.exports = {
  command: ["kick", "remove"],
  description: "Kick a user from the group",
  isGroup: true,
  isAdmin: true,

  async run({ sock, msg, from, args, text, settings }) {
    await react01(sock, from, msg.key, 1000);

    const quotedInfo   = msg.message.extendedTextMessage?.contextInfo;
    const mentionedJid = quotedInfo?.mentionedJid?.[0];
    const repliedToJid = quotedInfo?.participant;
    const target       = mentionedJid || repliedToJid;
    const prefix       = settings.prefix;

    if (!target) {
      return sock.sendMessage(from, {
        text: `⚠️ You must *@mention* or *reply to* the user you want to kick.\n\nUsage: \`${prefix}kick @user\``
      }, { quoted: msg });
    }

    if (target === sock.user.id) {
      return sock.sendMessage(from, { text: "🤖 I can't kick myself." }, { quoted: msg });
    }

    const targetNum = target.split("@")[0];

    // ── Style 3 — Action selector ──────────────────────────────────────────────
    // Each rowId is a real command that will be triggered when tapped
    const sections = [
      {
        title: "🛡️ Choose Action",
        rows: [
          {
            title: "👟 Kick (remove only)",
            rowId: `${prefix}kickconfirm ${target}`,
            description: `Remove @${targetNum} from the group`
          },
          {
            title: "⚠️ Warn before kick",
            rowId: `${prefix}warnkick ${target}`,
            description: `Send final warning then remove @${targetNum}`
          },
          {
            title: "🚫 Kick & announce",
            rowId: `${prefix}kickannounce ${target}`,
            description: `Kick and notify the group`
          }
        ]
      }
    ];

    // ── Style 5 — Target info card ─────────────────────────────────────────────
    await sock.sendMessage(from, {
      text: `🛡️ *Admin Action*\n\n▸ Target: @${targetNum}\n\nChoose what action to take from the list below.`,
      mentions: [target],
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: `Admin Panel — @${targetNum}`,
          body: "Select kick action from the list",
          previewType: "PHOTO",
          thumbnailUrl: BANNER_URL,
          sourceUrl: GITHUB_URL,
          mediaUrl:  GITHUB_URL,
          mediaType: 1
        }
      }
    }, { quoted: fakeQuote(from) });

    await sock.sendMessage(from, {
      text: `*Select Action for @${targetNum}*\n\nTap a row to execute the action instantly.`,
      footer: `Admin Panel  •  @${targetNum}`,
      title: "👟 Kick Options",
      buttonText: "🔽  Choose Action",
      sections,
      listType: 1
    }, { quoted: msg });
  }
};
