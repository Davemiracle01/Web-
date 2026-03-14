const fs = require("fs");
const settings = require("../settings.json");
const { react01 } = require('../lib/extra');

module.exports = {
  command: ["addsudo"],
  description: "Add a number to sudo list",
  isSudo: true,

  async run({ msg, sock, from, text }) {
    const quotedInfo = msg.message.extendedTextMessage?.contextInfo;
            const mentionedJid = quotedInfo?.mentionedJid?.[0];
            const repliedToJid = quotedInfo?.participant;
            const targetJid = mentionedJid || repliedToJid;

    if (!targetJid) {
      return sock.sendMessage(from, { text: "⚠️ Please @mention or reply to a user." }, { quoted: msg });
    }

    // Normalize to plain number for consistent storage
    const targetNumber = targetJid.split('@')[0];

    // Add to sudo list if not already present (check both formats)
    const alreadyIn = settings.sudo.some(s => String(s).replace(/[^0-9]/g, '') === targetNumber);
    if (!alreadyIn) {
      settings.sudo.push(targetNumber);
      fs.writeFileSync("./settings.json", JSON.stringify(settings, null, 2));
      
      await react01(sock, from, msg.key, 2000);
      return sock.sendMessage(from, {
        text: `✅ Added @${targetNumber} to sudo list.`,
        mentions: [targetJid]
      }, { quoted: msg });
    }

    // Already in sudo
    return sock.sendMessage(from, {
      text: "⚠️ Number already exists in sudo list."
    }, { quoted: msg });
  }
};