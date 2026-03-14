const axios = require("axios");
const { Sticker } = require("wa-sticker-formatter");

// You need to replace this with your actual Telegram bot token
const BOT_TOKEN = "YOUR_ACTUAL_BOT_TOKEN_HERE"; // Get from @BotFather

async function Telesticker(url) {
  return new Promise(async (resolve, reject) => {
    if (!url.match(/(https:\/\/t.me\/addstickers\/)/gi)) 
      return reject("❌ Invalid Telegram sticker link");

    const packName = url.replace("https://t.me/addstickers/", "");
    
    try {
      const res = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getStickerSet?name=${encodeURIComponent(packName)}`, {
        headers: { "User-Agent": "GoogleBot" },
      });

      if (!res.data.ok || !res.data.result.stickers) {
        return reject("❌ Sticker pack not found or inaccessible");
      }

      const resultList = [];
      const stickers = res.data.result.stickers;

      // Process first 10 stickers to avoid too many requests
      for (let i = 0; i < Math.min(10, stickers.length); i++) {
        try {
          const fileId = stickers[i].thumb?.file_id;
          if (!fileId) continue;

          const fileData = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
          
          if (fileData.data.ok) {
            const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.data.result.file_path}`;
            resultList.push(fileUrl);
          }
        } catch (fileError) {
          console.log("Error processing sticker:", fileError);
          continue;
        }
      }

      resolve(resultList);
    } catch (error) {
      reject(`❌ API Error: ${error.response?.data?.description || error.message}`);
    }
  });
}

module.exports = {
  command: ["telesticker", "telestick"],
  description: "Convert Telegram sticker pack to WhatsApp stickers",

  async run({ sock, msg, text, from }) {
    if (!text) return sock.sendMessage(from, { 
      text: "🔗 Send the Telegram sticker pack link\nExample: .telesticker https://t.me/addstickers/ShinobuKawaii" 
    }, { quoted: msg });

    try {
      const processingMsg = await sock.sendMessage(from, { 
        text: "⏳ Fetching sticker pack from Telegram..." 
      }, { quoted: msg });

      const stickers = await Telesticker(text);

      if (stickers.length === 0) {
        await sock.sendMessage(from, { 
          text: "❌ No stickers found or couldn't access the pack." 
        }, { quoted: msg });
        return;
      }

      await sock.sendMessage(from, { 
        text: `✅ Found ${stickers.length} stickers!\n📦 Converting to WhatsApp format...` 
      }, { quoted: msg });

      const limit = 5; // Limit to avoid spamming
      for (let i = 0; i < Math.min(limit, stickers.length); i++) {
        try {
          const sticker = new Sticker(stickers[i], {
            pack: "Telegram Pack",
            author: "Via Gabimaru",
            type: "default",
            quality: 70,
          });
          
          await sock.sendMessage(from, await sticker.toMessage(), { 
            quoted: i === 0 ? msg : null // Only quote the first one
          });
          
          // Small delay between stickers
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (stickerError) {
          console.log("Error creating sticker:", stickerError);
          continue;
        }
      }

      await sock.sendMessage(from, { 
        text: `✅ Successfully sent ${Math.min(limit, stickers.length)} stickers!` 
      }, { quoted: msg });

    } catch (e) {
      console.log("[telesticker error]", e);
      let errorMsg = "❌ Failed to fetch sticker pack. ";
      
      if (e.includes("Invalid token")) {
        errorMsg += "Bot token is invalid.";
      } else if (e.includes("Sticker set invalid")) {
        errorMsg += "Sticker pack not found or private.";
      } else {
        errorMsg += "Check the link and try again.";
      }
      
      sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
    }
  }
};