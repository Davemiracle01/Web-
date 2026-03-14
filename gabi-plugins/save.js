const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { react01 } = require('../lib/extra');
module.exports = {
  command: ["solo", "nawa"],
  description: " ",

  async run({ sock, msg, from }) {
  await react01(sock, from, msg.key, 2000);
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    const mediaType = quoted?.imageMessage ? "image"
                    : quoted?.videoMessage ? "video"
                    : null;

  if (!mediaType) {
      return sock.sendMessage(sock.user.id, {
        text: "❌ Please *reply to a view once image or short video* to retrieve."
      }, { quoted: msg });
    } 

    try {
      const stream = await downloadContentFromMessage(
        mediaType === "image" ? quoted.imageMessage : quoted.videoMessage,
        mediaType
      );

      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      await sock.sendMessage(sock.user.id, {
  [mediaType]: buffer,
  caption: `💥 Here's your removed view-once ${mediaType}`
}, {
  quoted: {
    key: {
      fromMe: false,
      participant: "0@s.whatsapp.net",
      remoteJid: from
    },
    message: {
      conversation: "🤺 Collected and secured"
    }
  }
});

    } catch (err) {
      console.error("❌ Sticker plugin error:", err);
      await sock.sendMessage(sock.user.id, {
        text: "⚠️ Failed to retrieve view once."
      }, { quoted: msg });
    }
  }
};