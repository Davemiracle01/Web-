const dann = require('d-scrape')
const { react01 } = require('../lib/extra');
let anu;

module.exports = {
    command: ['tiktoksearch', 'ttsearch'],
    description: 'TikTok video search using nodeJs dependency.',
    category: 'Fun',
    
    run: async ({ sock, msg, from, sender, settings, text }) => {
   await react01(sock, from, msg.key, 2000);
   
           if (!text || text.length === 0) {
            return sock.sendMessage(from, { 
                text: `⚠️ Please provide a search.\nUsage: ${settings.prefix}ttsearch Yagami` 
            }, { quoted: msg });
        }
       
       anu = await dann.search.tiktoks(text)
       await sock.sendMessage(from, { video: { url: anu.no_watermark }, caption: anu.title }, { quoted: msg });
      }
};