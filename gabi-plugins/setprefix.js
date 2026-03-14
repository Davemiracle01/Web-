const fs = require('fs');
const path = require('path');
const { react01 } = require('../lib/extra');

module.exports = {
    command: ['setprefix', 'prefix'],
    description: 'Change the bot command prefix',
    isSudo: true,
    
    run: async ({ sock, msg, from, args, text, isOwner, settings }) => {
    
    await react01(sock, from, msg.key, 2000);
        if (!text || text.trim().length === 0) {
            return sock.sendMessage(from, { 
                text: `⚠️ Please provide a new prefix.\nCurrent prefix: ${settings.prefix}\nUsage: ${settings.prefix}setprefix <new_prefix>` 
            }, { quoted: msg });
        }

        const newPrefix = text.trim();
        
        // Validate prefix length
        if (newPrefix.length > 3) {
            return sock.sendMessage(from, { 
                text: "❌ Prefix cannot be longer than 3 characters." 
            }, { quoted: msg });
        }

        try {
            // Update settings in memory
            settings.prefix = newPrefix;
            
            // Update settings file
            const settingsPath = path.join(__dirname, '..', 'settings.json');
            const currentSettings = require(settingsPath);
            currentSettings.prefix = newPrefix;
            
            fs.writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));
            
            await sock.sendMessage(from, { 
                text: `✅ Prefix successfully changed to: "${newPrefix}"` 
            }, { quoted: msg });
            
        } catch (error) {
            console.error('Error updating prefix:', error);
            await sock.sendMessage(from, { 
                text: "❌ Failed to update prefix. Check console for details." 
            }, { quoted: msg });
        }
    }
};