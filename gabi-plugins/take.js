const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const { Sticker, StickerTypes } = require("wa-sticker-formatter");
const { react01 } = require('../lib/extra');

module.exports = {
  command: ["take", "claim", "steal"],
  description: "Change sticker packname and author with advanced options",
  category: "Fun", 

  async run({ sock, msg, from, text }) {
    await react01(sock, from, msg.key, 2000);
    
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    
    if (!quoted?.stickerMessage) {
      return sock.sendMessage(from, {
        text: "❌ Please *reply to a sticker* with .take [packname] [author]\nExample: *.take Gabimaru Kekegenka*"
      }, { quoted: msg });
    }

    let newPackName = "Gabimaru Stickers";
    let newAuthor = "Ayo Kunle";
    
    if (text.trim()) {
      const args = text.trim().split(/\s+/);
      if (args.length >= 2) {
        newPackName = args.slice(0, -1).join(" ");
        newAuthor = args[args.length - 1];
      } else if (args.length === 1) {
        newPackName = args[0];
      }
    }

    try {
      // Download the sticker
      const stream = await downloadContentFromMessage(quoted.stickerMessage, "sticker");
      
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      // Create new sticker with changed metadata
      const sticker = new Sticker(buffer, {
        pack: newPackName,
        author: newAuthor,
        type: StickerTypes.FULL,
        quality: 90, // Higher quality
        categories: ['❤️', '🔥', '😎'],
      });

      const stickerBuffer = await sticker.toBuffer();

      // Send the sticker
      await sock.sendMessage(from, {
        sticker: stickerBuffer
      }, { quoted: msg });

    } catch (err) {
      console.error("❌ Take plugin error:", err);
      await sock.sendMessage(from, {
        text: "⚠️ Failed to modify sticker. The sticker might be corrupted or too large."
      }, { quoted: msg });
    }
  }
};