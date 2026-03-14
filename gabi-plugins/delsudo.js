const fs = require("fs");
const settings = require("../settings.json");
const { react01 } = require('../lib/extra');

module.exports = {
  command: ["delsudo", "delsudo_num"],
  description: "Remove a number from sudo list",
  isSudo: true,

  async run({ msg, sock, from, commandName, text }) {
    // delsudo_num is called by listsudo list rows with the number as text arg
    let targetNumber;

    if (commandName === "delsudo_num" && text?.trim()) {
      // Called from list row: .delsudo_num 2347010911213
      targetNumber = text.trim().replace(/[^0-9]/g, '');
    } else {
      // Called normally via @mention or reply
      const quotedInfo   = msg.message.extendedTextMessage?.contextInfo;
      const mentionedJid = quotedInfo?.mentionedJid?.[0];
      const repliedToJid = quotedInfo?.participant;
      const targetJid    = mentionedJid || repliedToJid;

      if (!targetJid) {
        return sock.sendMessage(from, { text: "⚠️ Please @mention or reply to a user." }, { quoted: msg });
      }
      targetNumber = targetJid.split('@')[0];
    }

    if (!targetNumber) {
      return sock.sendMessage(from, { text: "⚠️ Could not determine target number." }, { quoted: msg });
    }

    const exists = settings.sudo.some(s => String(s).replace(/[^0-9]/g, '') === targetNumber);

    if (exists) {
      settings.sudo = settings.sudo.filter(user => String(user).replace(/[^0-9]/g, '') !== targetNumber);
      fs.writeFileSync("./settings.json", JSON.stringify(settings, null, 2));
      await react01(sock, from, msg.key, 2000);
      return sock.sendMessage(from, {
        text: `✅ Removed +${targetNumber} from sudo list.`
      }, { quoted: msg });
    }

    return sock.sendMessage(from, {
      text: "⚠️ Number not found in sudo list."
    }, { quoted: msg });
  }
};