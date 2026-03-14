const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Sends reactios
 * @param {Object} sock - The socket instance
 * @param {string} from - The chat JID
 * @param {Object} msgKey - The message key to react to
 * @param {number} delayMs - Delay in milliseconds (default: 2000 = 2 seconds)
 */
async function react01(sock, from, msgKey, delayMs = 2000) {
    try {
        // Show first reaction
        await sock.sendMessage(from, { 
            react: { 
                text: '⏳', 
                key: msgKey 
            } 
        });
        
        // Wait......
        await delay(delayMs);
        
        // Show checkmark reaction
        await sock.sendMessage(from, { 
            react: { 
                text: '✅', 
                key: msgKey 
            } 
        });
        
    } catch (error) {
        console.error('Error in reacting:', error.message);
        try {
            await sock.sendMessage(from, { 
                react: { 
                    text: '❌', 
                    key: msgKey 
                } 
            });
        } catch (fallbackError) {
            console.error('Fallback reaction also failed:', fallbackError.message);
        }
    }
}

async function error01(sock, from, msgKey, delayMs = 2000) {
    try {
        await delay(delayMs);
        await sock.sendMessage(from, { 
            react: { 
                text: '❌', 
                key: msgKey 
            } 
        });
        
    } catch (error) {
        console.error('Error in reacting:', error.message);
        try {
            await sock.sendMessage(from, { 
                react: { 
                    text: '❌', 
                    key: msgKey 
                } 
            });
        } catch (fallbackError) {
            console.error('Fallback reaction also failed:', fallbackError.message);
        }
    }
}

/**
 * React with a custom emojis
 * @param {Object} sock - The socket instance
 * @param {string} from - The chat JID
 * @param {Object} msgKey - The message key to react to
 * @param {string} firstEmoji - First emoji to show (default: '⏳')
 * @param {string} finalEmoji - Final emoji to show (default: '✅')
 * @param {number} delayMs - Delay in milliseconds (default: 2000)
 */
async function react02(sock, from, msgKey, firstEmoji = '⏳', finalEmoji = '✅', delayMs = 2000) {
    try {
        // Show first reaction
        await sock.sendMessage(from, { 
            react: { 
                text: firstEmoji, 
                key: msgKey 
            } 
        });
        
        // Wait.........
        await delay(delayMs);
        
        // Show final reaction
        await sock.sendMessage(from, { 
            react: { 
                text: finalEmoji, 
                key: msgKey 
            } 
        });
        
    } catch (error) {
        console.error('Error in Reaction:', error.message);
    }
}

module.exports = {
    react01,
    react02,
    delay,
    error01
};