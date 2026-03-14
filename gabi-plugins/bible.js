const axios = require("axios");
const { react01 } = require('../lib/extra');

module.exports = {
  command: ["bible", "verse", "bverse"],
  description: "Get a Bible verse (KJV)",

  async run({ msg, sock, from, text }) {
    const query = text;
    if (!query) {
      return sock.sendMessage(from, {
        text: "⚠️ Provide a Bible verse.\n\nExample: `.bible John 3:16`"
      }, { quoted: msg });
    }

    try {
      const { data } = await axios.get(`https://ayokunle-restapi-8ma5.onrender.com/bibleverse?verse=${encodeURIComponent(query)}`);

      if (!data || !data.text || !data.verse) {
        return sock.sendMessage(from, {
          text: "❌ Verse not found or invalid format. Try something like:\n`.bible Romans 8:28`"
        }, { quoted: msg });
      }
      
      await react01(sock, from, msg.key, 2000);
      await sock.sendMessage(from, {
        text:
`📖 *${data.verse}* (${data.version})

🕊️ ${data.text}

— _Keep the sabbath day holy_`
      }, { quoted: msg });

    } catch (err) {
      console.error("Bible plugin error:", err.message);
      return sock.sendMessage(from, {
        text: "❌ Failed to fetch verse. Try again later."
      }, { quoted: msg });
    }
  }
};