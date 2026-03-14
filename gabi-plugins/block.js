const { react01 } = require('../lib/extra');

module.exports = {
  command: ["block", "unblock"],
  description: "Block or unblock a user on WhatsApp",
  isSudo: true, // only sudo/owner can run

  async run({ sock, msg, from, commandName, args }) {
    try {
      const quotedInfo = msg.message.extendedTextMessage?.contextInfo;
      const mentionedJid = quotedInfo?.mentionedJid?.[0];
      const repliedToJid = quotedInfo?.participant;
      let targetJid = mentionedJid || repliedToJid;

      // If no reply/mention, check args
      if (!targetJid && args[0]) {
        targetJid = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
      }

      // If still no target, default to the chat itself
      if (!targetJid) {
        targetJid = from;
      }

      if (!targetJid) {
        return sock.sendMessage(from, { text: " Reply, mention, or give a number to block/unblock." }, { quoted: msg });
      }
      await react01(sock, from, msg.key, 2000);
      if (commandName === "block") {
        await sock.updateBlockStatus(targetJid, "block");
        return sock.sendMessage(from, {
          text: `Blocked: @${targetJid.split("@")[0]}`,
          mentions: [targetJid]
        }, { quoted: msg });
      } else {
        await sock.updateBlockStatus(targetJid, "unblock");
        return sock.sendMessage(from, {
          text: `Unblocked: @${targetJid.split("@")[0]}`,
          mentions: [targetJid]
        }, { quoted: msg });
      }

    } catch (err) {
      console.error("Block plugin error:", err);
      return sock.sendMessage(from, { text: "Failed to update block the user." }, { quoted: msg });
    }
  }
};