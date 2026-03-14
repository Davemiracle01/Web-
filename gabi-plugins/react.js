const fetch = require('node-fetch');
const { react01 } = require('../lib/extra');
module.exports = {
    command: ['react', 'autolike'],
    description: 'Send reactions to WhatsApp channel messages using TMK Autolike API',
    category: 'Utility',
    usage: '.react <channel_link> <emoji>',
    example: '.react https://whatsapp.com/channel/0029VbB3x7IIyPtU0Sa3163f/124 ❤️',
    
    run: async ({ sock, msg, from, args, text }) => {
        try {
        await react01(sock, from, msg.key, 2000);
            if (args.length < 1) {
                return await sock.sendMessage(from, {
                    text: `❌ *Usage:* .react <channel_link> <emoji>\n📌 *Example:* .react https://whatsapp.com/channel/0029VbB3x7IIyPtU0Sa3163f/124 ❤️`
                }, { quoted: msg });
            }

            const channelLink = args[0];
            let emoji = '❤️'; // Default emoji
            if (args.length >= 2) {
                emoji = args[1];
            }
            
            if (!channelLink.includes('whatsapp.com/channel/') && !channelLink.includes('channel.whatsapp.com')) {
                return await sock.sendMessage(from, {
                    text: `❌ *Invalid Link!*\n\nPlease provide a valid WhatsApp channel link.\n📌 Format: https://whatsapp.com/channel/CHANNEL_ID/MESSAGE_ID\n📌 Or: https://channel.whatsapp.com/INVITE_CODE`
                }, { quoted: msg });
            }
            let processedLink = channelLink;
            if (channelLink.includes('channel.whatsapp.com')) {
                const inviteCode = channelLink.split('channel.whatsapp.com/')[1];
                processedLink = `https://whatsapp.com/channel/${inviteCode}`;
            }

            const processingMsg = await sock.sendMessage(from, {
                text: `⏳ *Processing Reaction...*\n\n🔗 Link: ${processedLink}\n🎯 Emoji: ${emoji}\n\n⚡ Contacting TMK Autolike Server...`
            }, { quoted: msg });

            try {
                const apiUrl = `https://ayokunle-restapi-8ma5.onrender.com/react?channelmsglink=${encodeURIComponent(processedLink)}&emoji=${encodeURIComponent(emoji)}&secret=TMKRULEZBROO`;
                const maxRetries = 3;
                let retryCount = 0;
                let response;
                let dataa;
                
                while (retryCount < maxRetries) {
                    try {
                        const timeoutPromise = new Promise((_, reject) => {
                            setTimeout(() => reject(new Error('API timeout after 30 seconds')), 30000);
                        });
                        
                        response = await Promise.race([
                            fetch(apiUrl),
                            timeoutPromise
                        ]);
                        
                        dataa = await response.json();
                        break;
                    } catch (retryError) {
                        retryCount++;
                        if (retryCount >= maxRetries) {
                            throw retryError;
                        }
                        const delay = Math.pow(2, retryCount) * 1000;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        
                        await sock.sendMessage(from, {
                            text: `⏳ *Processing Reaction...* (Retry ${retryCount}/${maxRetries})\n\n🔗 Link: ${processedLink}\n🎯 Emoji: ${emoji}\n\n⚡ Retrying connection to TMK Autolike Server...`
                        }, { quoted: msg });
                    }
                }

                if (dataa && dataa.data.success) {
                    // Success response
                    let resultText = `✅ *TMK Autolike Successful!*\n\n`;
                    resultText += `• Reactions: ${dataa.data.totalSessions}\n`;
                    resultText += `• Reaction: ${emoji}\n\n`;
                    resultText += `⚡ *Powered by TMK WA TEAM*\n`;
                    resultText += `🌐 *API Server:* tmk-pairsite.zone.id`;

/*                    await sock.sendMessage(from, { text: resultText }, { quoted: msg }); */
await sock.sendMessage(from, {
    text: resultText,
    contextInfo: {
        forwardingScore: 5,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: "120363402888937015@newsletter",
            newsletterName: "Ayo Kunle ❤️‍🔥",
        },
    },
}, { quoted: msg });
                    await sock.sendMessage(from, { delete: processingMsg.key });

                } else {
                    // API returned error
                    await sock.sendMessage(from, {
                        text: `❌ *Autolike Failed!*\n\n📛 Error: ${dataa?.message || 'Unknown error'}\n${dataa?.error ? `🔧 Details: ${dataa.error}` : ''}\n\n🔗 Link: ${processedLink}\n🎯 Emoji: ${emoji}`
                    }, { quoted: msg });
                    
                    await sock.sendMessage(from, { delete: processingMsg.key });
                }

            } catch (apiError) {
                // API call failed (network error, etc.)
                console.error('API Error:', apiError);
                await sock.sendMessage(from, {
                    text: `❌ *API Connection Failed!*\n\n📛 Could not connect to TMK Autolike server.\n🔧 Error: ${apiError.message}\n\n⚠️ Please try again later or contact support.`
                }, { quoted: msg });
                
                await sock.sendMessage(from, { delete: processingMsg.key });
            }

        } catch (error) {
            console.error('React Plugin Error:', error);
            await sock.sendMessage(from, {
                text: `❌ *Unexpected Error!*\n\n📛 Something went wrong while processing your request.\n🔧 Error: ${error.message}\n\n⚠️ Please try again later.`
            }, { quoted: msg });
        }
    }
};