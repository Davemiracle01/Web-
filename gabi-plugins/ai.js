const axios = require('axios');
const { react02 } = require('../lib/extra');

module.exports = {
    command: ['ai', 'ask', 'gai'],
    description: 'Chat with Gabimaru AI using external API',
    category: 'Utility',
    
    run: async ({ sock, msg, from, sender, text, args }) => {
    await react02(sock, from, msg.key, '🔵', '🤖', 2000)
        try {
            // Check if there's a question
            if (!text.trim()) {
                return await sock.sendMessage(from, { 
                    text: "❌ Please provide a question after the command.\nExample: *.ai Hello, how are you?*" 
                }, { quoted: msg });
            }

            await sock.sendPresenceUpdate('composing', from);

            const encodedQuestion = encodeURIComponent(text);
            const apiUrl = `https://ayokunle-restapi-8ma5.onrender.com/chatbot?ask=${encodedQuestion}`;

            // Make API request
            const response = await axios.get(apiUrl, { timeout: 10000 });
            const data = response.data;

            if (data.status === 'success') {
                let replyText = `💭 *Gabimaru AI Response*\n\n`;
                replyText += `🔹 *Question:* ${data.question}\n`;
                replyText += `🔹 *Answer:* ${data.reply}\n\n`;
                replyText += `⚡ *Response Time:* ${data.answer_time.toFixed(2)}s\n`;
                replyText += `👨‍💻 *Creator:* ${data.creator}`;

                await sock.sendMessage(from, { text: replyText }, { quoted: msg });
            } else {
                throw new Error('API returned unsuccessful status');
            }

        } catch (error) {
            console.error('AI Plugin Error:', error);
            
            let errorMessage = "❌ Sorry, I couldn't process your request right now. ";
            
            if (error.code === 'ECONNABORTED') {
                errorMessage += "The request timed out. Please try again.";
            } else if (error.response?.status === 404) {
                errorMessage += "API endpoint not found.";
            } else if (error.response?.status >= 500) {
                errorMessage += "Server is currently unavailable. Try again later.";
            } else {
                errorMessage += "Please try again in a moment.";
            }

            await sock.sendMessage(from, { text: errorMessage }, { quoted: msg });
        }
    }
};