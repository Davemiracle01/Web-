const { react01 } = require('../lib/extra');
const googleTTS = require('google-tts-api')

module.exports = {
    command: ['say', 'repeat', 'tts'],
    description: 'Text to sound using Google services.',
    category: 'Fun',
    
    run: async ({ sock, msg, from, sender, settings, text }) => {
   await react01(sock, from, msg.key, 2000);
  
             if (!text) {
            return sock.sendMessage(from, { 
                text: `⚠️ Please provide a search.\nUsage: ${settings.prefix}tts I am Kira` 
            }, { quoted: msg });
        }
        
      let texttts = text
            const ttssound = googleTTS.getAudioUrl(texttts, {
                lang: "en",
                slow: false,
                host: "https://translate.google.com",
            })
            return sock.sendMessage(from, {
                audio: {
                    url: ttssound,
                },
                mimetype: 'audio/mp4',
                ptt: true,
                fileName: `${text}.mp3`,
            }, {
                quoted: msg,
            })
 }
};