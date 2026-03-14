const axios = require('axios');
const { react01 } = require('../lib/extra');

module.exports = {
    command: ['pin', 'pinterest'],
    desc: 'Search for images on Pinterest',
    category: 'Search',
    
    async run({ sock, msg, from, text }) {
    
    await react01(sock, from, msg.key, 2000);
        if (!text) {
            return await sock.sendMessage(from, { 
                text: "❌ Usage: .pin <search term>\nExample: .pin anime wallpapers" 
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { 
                text: `🔍 Searching Pinterest for *${text}*...` 
            }, { quoted: msg });

            const response = await axios.get(`https://delirius-apiofc.vercel.app/search/pinterest`, {
                params: { text: encodeURIComponent(text) },
                timeout: 30000
            });

            const data = response.data;

            if (!data.status || !data.results || data.results.length === 0) {
                return await sock.sendMessage(from, { 
                    text: "❌ No Pinterest results found for your search." 
                }, { quoted: msg });
            }

            // Pick 5 random images
            const results = data.results.sort(() => 0.5 - Math.random()).slice(0, 5);

            for (let img of results) {
                await sock.sendMessage(from, {
    image: { url: img },
    caption: `✨ Pinterest result for *${text}*`,
    contextInfo: {
      forwardingScore: 9,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363402888937015@newsletter",
        newsletterName: "Gabimaru Assistant 🥷",
      }
    }
  }, { quoted: msg });
                
                // Add a small delay between images to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        } catch (err) {
            console.error("❌ Pinterest plugin error:", err.message);
            
            if (err.code === 'ECONNABORTED') {
                await sock.sendMessage(from, { 
                    text: "❌ Request timeout. Please try again later." 
                }, { quoted: msg });
            } else if (err.response?.status === 404) {
                await sock.sendMessage(from, { 
                    text: "❌ Pinterest API endpoint not found." 
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { 
                    text: "❌ Failed to fetch Pinterest images. The service might be temporarily unavailable." 
                }, { quoted: msg });
            }
        }
    }
};