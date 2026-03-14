const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");
const { react01 } = require('../lib/extra');
module.exports = {
  command: ["sticker", "s"],
  description: "Convert an image or short video to sticker",

  async run({ sock, msg, from }) {
  await react01(sock, from, msg.key, 2000);
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    const mediaType = quoted?.imageMessage ? "image"
                    : quoted?.videoMessage ? "video"
                    : null;

    if (!mediaType) {
      return sock.sendMessage(from, {
        text: "❌ Please *reply to an image or short video* to create a sticker."
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

      const sticker = new Sticker(buffer, {
        pack: "Gabimaru Stickers",
        author: "Ayo Kunle",
        type: StickerTypes.FULL,
        quality: 80,
      });

      const stickerBuffer = await sticker.toBuffer();

      await sock.sendMessage(from, {
        sticker: stickerBuffer
      }, { quoted: msg });

    } catch (err) {
      console.error("❌ Sticker plugin error:", err);
      await sock.sendMessage(from, {
        text: "⚠️ Failed to create sticker. Make sure the media is valid and under 10s for video."
      }, { quoted: msg });
    }
  }
};