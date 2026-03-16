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

    await sock.sendMessage(from, {
      text: `🛡️ *Admin Action*\n\n▸ Target: @${targetNum}\n\n👟 Removing user from group...`,
      mentions: [target],
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: `Admin Panel — @${targetNum}`,
          body: "Kick action executed",
          previewType: "PHOTO",
          thumbnailUrl: BANNER_URL,
          sourceUrl: GITHUB_URL,
          mediaUrl:  GITHUB_URL,
          mediaType: 1
        }
      }
    }, { quoted: fakeQuote(from) });

    await sock.groupParticipantsUpdate(from, [target], "remove");

    await sock.sendMessage(from, {
      text: `✅ @${targetNum} has been removed from the group.`,
      mentions: [target]
    }, { quoted: msg });
  }
};
