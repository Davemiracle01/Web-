const axios = require("axios");
const { react01 } = require('../lib/extra');

module.exports = {
  command: ["animechar"],
  description: "Get info about an anime character",

  async run({ msg, sock, from, text }) {
    const query = text;
    if (!query) {
      return sock.sendMessage(from, {
        text: "⚠️ Provide a character name.\n\nExample: `.animechar naruto`"
      }, { quoted: msg });
    }

    try {
      const { data } = await axios.get(`https://ayokunle-restapi-8ma5.onrender.com/api/animechar?name=${encodeURIComponent(query)}`);

      if (!data || !data.name || !data.anime) {
        return sock.sendMessage(from, {
          text: "❌ Character not found or invalid response from api."
        }, { quoted: msg });
      }
      
      await react01(sock, from, msg.key, 2000);
      await sock.sendMessage(from, {
        image: { url: data.image },
        caption:
`🎌 *${data.name}*
📺 Anime: ${data.anime}

📝 ${data.description}

🔗 Source: ${data.source}`
      }, { quoted: msg });

    } catch (err) {
      console.error("plugin error:", err.message);
      return sock.sendMessage(from, {
        text: "❌ Failed to fetch character info. Try again later."
      }, { quoted: msg });
    }
  }
};