const axios = require('axios');
const { react01, error01 } = require('../lib/extra');

module.exports = {
  command: ["textfx", "texteffect"],
  description: "Create text effects with free API",
  category: "Fun",

  async run({ sock, msg, from, text }) {
    await react01(sock, from, msg.key, 2000);

    if (!text) {
      return sock.sendMessage(from, {
        text: "❌ Please provide text!\nExample: .textfx neon Hello World"
      }, { quoted: msg });
    }

    try {
      // Using a free text effect API
      const response = await axios.get('https://api.textfx.com/neon', {
        params: { text: text },
        responseType: 'arraybuffer'
      });

      await sock.sendMessage(from, {
        image: Buffer.from(response.data),
        caption: `✨ Neon Effect: ${text}`
      }, { quoted: msg });

    } catch (error) {
      await error01(sock, from, msg.key, 2000);
      await sock.sendMessage(from, {
        text: "⚠️ Text effect service is currently down. Try again later."
      }, { quoted: msg });
    }
  }
};