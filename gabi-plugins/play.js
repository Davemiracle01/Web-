const yts = require('yt-search');
const ytdl = require('@vreden/youtube_scraper');

module.exports = {
    command: ['play', 'music'],
    description: 'Play music from YouTube',
    category: 'Utility',
    
    async run({ sock, msg, from, text }) {
        try {
            if (!text) {
                return sock.sendMessage(from, { 
                    text: `❌ Please provide a song name!\nExample: ${`${settings.prefix}play <song name>`}` 
                }, { quoted: msg });
            }

            // Show processing reaction
            await sock.sendMessage(from, {
                react: {
                    text: '🎶',
                    key: msg.key
                }
            });

            // Search for the song
            let ytsSearch = await yts(text);
            const res = await ytsSearch.all[0];

            if (!res) {
                return sock.sendMessage(from, { 
                    text: '❌ No results found for that search.' 
                }, { quoted: msg });
            }

            // Download as MP3
            var anu = await ytdl.ytmp3(res.url);

            if (anu.status) {
                let urlMp3 = anu.download.url;
                
                // Send the audio with rich metadata
                await sock.sendMessage(from, {
                    audio: { 
                        url: urlMp3 
                    },
                    mimetype: "audio/mpeg",
                    contextInfo: { 
                        externalAdReply: {
                            thumbnailUrl: res.thumbnail,
                            title: res.title,
                            body: `Author: ${res.author.name} || Duration: ${res.timestamp}`,
                            sourceUrl: res.url,
                            renderLargerThumbnail: true,
                            mediaType: 1
                        }
                    }
                }, { quoted: msg });

                // Remove reaction
                await sock.sendMessage(from, {
                    react: {
                        text: '',
                        key: msg.key
                    }
                });

            } else {
                return sock.sendMessage(from, { 
                    text: '❌ Error! Failed to download the audio.' 
                }, { quoted: msg });
            }

        } catch (err) {
            console.error('Play command error:', err);
            
            // Error reaction
            await sock.sendMessage(from, {
                react: {
                    text: '❌',
                    key: msg.key
                }
            });
            
            await sock.sendMessage(from, { 
                text: '⚠️ An error occurred while processing your request.' 
            }, { quoted: msg });
        }
    }
};