const axios = require('axios');
const { react01 } = require('../lib/extra');

module.exports = {
    command: ["nom", "poke", "cry", "kiss", "pat", "hug", "wink", "facepalm", "face-palm", "quote"],
    description: "Get random anime GIFs for various actions",
    category: "Fun",
    isOwner: false,
    isGroup: true,
    isAdmin: false,

    async run({ sock, msg, from, args, text, commandName, settings }) {
        await react01(sock, from, msg.key, 2000);

        // Map command names to API types (handle facepalm/face-palm)
        const actionType = commandName === 'facepalm' ? 'face-palm' : commandName;
        
        const actionNames = {
            'nom': 'eating',
            'poke': 'poking',
            'cry': 'crying',
            'kiss': 'kissing',
            'pat': 'patting',
            'hug': 'hugging',
            'wink': 'winking',
            'face-palm': 'face-palming',
            'quote': 'anime quote'
        };

        try {
            await sock.sendMessage(from, {
                text: `🎭 Generating ${actionNames[actionType]} ${actionType === 'quote' ? '' : 'GIF'}........`
            }, { quoted: msg });

            const apiUrl = `https://api.some-random-api.com/animu/${actionType}`;
            
            const response = await axios.get(apiUrl, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'WhatsApp-Bot/1.0'
                }
            });

            if (response.data && response.data.link) {
                if (actionType === 'quote') {
                    await sock.sendMessage(from, {
                        text: `💬 *Anime Quote*\n\n${response.data.quote || response.data.link}\n\n✨ Random anime quote`
                    }, { quoted: msg });
                } else {
         const gifResponse = await axios.get(response.data.link, {
                        responseType: 'arraybuffer',
                        timeout: 15000
                    });

                    await sock.sendMessage(from, {
                        video: gifResponse.data,
                        gifPlayback: true,
                        caption: ``
                    }, { quoted: msg });
                }
            } else {
                throw new Error('Invalid API response');
            }

        } catch (error) {
            console.error('Anime GIF Error:', error);
            
            let errorMessage = `❌ Failed to get ${actionNames[actionType]} ${actionType === 'quote' ? 'quote' : 'GIF'}\n`;
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += '• API timeout\n';
            } else if (error.response?.status === 404) {
                errorMessage += '• Action not found\n';
            } else if (error.response?.status === 429) {
                errorMessage += '• Rate limited, try again later\n';
            } else {
                errorMessage += `• ${error.message}\n`;
            }
            
            errorMessage += '\nThe API might be temporarily down';

            await sock.sendMessage(from, {
                text: errorMessage
            }, { quoted: msg });
        }
    }
};