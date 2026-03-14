const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const { react01 } = require('../lib/extra');

module.exports = {
    command: ['tiktok', 'tt', 'tikdl'],
    description: 'Download TikTok videos',
    
    run: async ({ sock, msg, from, args, text }) => {
        await react01(sock, from, msg.key, 2000);
        try {
            if (!text) {
                return sock.sendMessage(from, { 
                    text: `Please provide a TikTok URL\n\nExample: ${settings.prefix}tiktok https://vm.tiktok.com/ZSAuUvV9S/` 
                }, { quoted: msg });
            }

            // Extract TikTok URL from text
            const urlMatch = text.match(/(https?:\/\/vm\.tiktok\.com\/[^\s]+|https?:\/\/www\.tiktok\.com\/@[^\/]+\/video\/\d+[^\s]*)/i);
            if (!urlMatch) {
                return sock.sendMessage(from, { 
                    text: '❌ Invalid TikTok URL. Please provide a valid TikTok link.' 
                }, { quoted: msg });
            }

            const tiktokUrl = urlMatch[0];
            
            await sock.sendMessage(from, { 
                text: 'Downloading TikTok video...' 
            }, { quoted: msg });

            const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });
            
            if (response.data.code !== 0 || !response.data.data) {
                throw new Error('Failed to download TikTok video');
            }

            const videoData = response.data.data;
            
            const tempDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }

            // Download the video
            const videoResponse = await axios({
                method: 'GET',
                url: videoData.wmplay || videoData.play,
                responseType: 'stream',
                timeout: 60000
            });

            const timestamp = Date.now();
            const filename = `tiktok_${timestamp}.mp4`;
            const filePath = path.join(tempDir, filename);

            await pipeline(videoResponse.data, fs.createWriteStream(filePath));

            const fileStats = fs.statSync(filePath);
            const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

            // Check if file is too large for WhatsApp (max ~16MB)
            if (fileStats.size > 15 * 1024 * 1024) {
                fs.unlinkSync(filePath);
                return sock.sendMessage(from, { 
                    text: `❌ Video is too large (${fileSizeMB}MB). WhatsApp has a 16MB limit for videos.` 
                }, { quoted: msg });
            }

            // Send the video with caption
            const caption = `🎵 *TikTok Download*\n\n` +
                           `*Title:* ${videoData.title || 'No title'}\n` +
                           `👤 *Author:* ${videoData.author?.nickname || 'Unknown'}\n` +
                           `*Likes:* ${videoData.digg_count?.toLocaleString() || '0'}\n` +
                           `*Comments:* ${videoData.comment_count?.toLocaleString() || '0'}\n` +
                           `*Shares:* ${videoData.share_count?.toLocaleString() || '0'}\n` +
                           `*Downloads:* ${videoData.download_count?.toLocaleString() || '0'}\n` +
                           `*Duration:* ${videoData.duration}s\n`;

            await sock.sendMessage(from, {
    video: fs.readFileSync(filePath),
    caption: caption
}, { quoted: msg });

            // Clean up temporary file
            fs.unlinkSync(filePath);

        } catch (error) {
            console.error('TikTok download error:', error);
            
            let errorMessage = '❌ Failed to download TikTok video. ';
            
            if (error.response?.status === 404) {
                errorMessage += 'Video not found or private.';
            } else if (error.code === 'ECONNABORTED') {
                errorMessage += 'Request timed out.';
            } else if (error.message.includes('Failed to download')) {
                errorMessage += 'The video might be private or unavailable.';
            } else {
                errorMessage += 'Please try again later.';
            }

            await sock.sendMessage(from, { 
                text: errorMessage 
            }, { quoted: msg });
        }
    }
};