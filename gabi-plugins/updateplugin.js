const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { react01 } = require('../lib/extra');

module.exports = {
    command: ["updateplugin", "upgradeplugin", "pluginupdate"],
    description: "Update an existing plugin from GitHub/Gist URL",
    isOwner: true,

    async run({ sock, msg, from, args, text, isOwner, settings }) {
        await react01(sock, from, msg.key, 2000);

        if (args.length < 2) {
            return sock.sendMessage(from, { 
                text: `❌ Usage: ${settings.prefix}updateplugin <plugin_name> <plugin_url>\n\nExample: ${settings.prefix}updateplugin tiktok https://raw.githubusercontent.com/user/repo/main/tiktok.js\n\nUse ${settings.prefix}menu to see available plugins.` 
            }, { quoted: msg });
        }

        const pluginName = args[0].toLowerCase();
        let pluginUrl = args[1];
        const pluginsDir = path.join(__dirname);
        const pluginFile = path.join(pluginsDir, `${pluginName}.js`);

        // Check if plugin exists
        if (!fs.existsSync(pluginFile)) {
            return sock.sendMessage(from, { 
                text: `❌ Plugin "${pluginName}" not found!\n\nUse ${settings.prefix}menu to see available plugins or ${settings.prefix}addplugin to add a new one.` 
            }, { quoted: msg });
        }

        // Process Gist URLs
        if (pluginUrl.includes('gist.github.com') && !pluginUrl.includes('/raw/')) {
            const gistMatch = pluginUrl.match(/gist\.github\.com\/([^\/]+\/)?([a-f0-9]+)/i);
            if (gistMatch && gistMatch[2]) {
                const gistId = gistMatch[2];
                pluginUrl = `https://gist.githubusercontent.com/${gistMatch[1] || ''}${gistId}/raw`;
            }
        }

        try {
            // Download the updated plugin
            const response = await axios.get(pluginUrl, { 
                timeout: 15000,
                headers: { 'User-Agent': 'WhatsApp-Bot-Plugin-Updater' }
            });
            
            const pluginCode = response.data;
            
            if (!pluginCode || pluginCode.trim().length === 0) {
                return sock.sendMessage(from, { 
                    text: "❌ Downloaded file is empty." 
                }, { quoted: msg });
            }

            // Backup the current plugin
            const backupDir = path.join(__dirname, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir);
            }
            
            const backupFile = path.join(backupDir, `${pluginName}_backup_${Date.now()}.js`);
            fs.copyFileSync(pluginFile, backupFile);

            // Save the updated plugin
            fs.writeFileSync(pluginFile, pluginCode);
            
            // Verify the new plugin has valid structure
            let isValidPlugin = false;
            try {
                delete require.cache[require.resolve(pluginFile)];
                const newPlugin = require(pluginFile);
                isValidPlugin = newPlugin && (newPlugin.command || newPlugin.run);
            } catch (validationError) {
                // Restore from backup if invalid
                fs.copyFileSync(backupFile, pluginFile);
                return sock.sendMessage(from, { 
                    text: `❌ Update failed: Invalid plugin structure. Restored from backup.\nError: ${validationError.message}` 
                }, { quoted: msg });
            }

            // Auto-reload plugins
            try {
                if (typeof global.loadPlugins === 'function') {
                    global.loadPlugins(); // Reload all plugins
                    
                    // Get plugin info for confirmation
                    delete require.cache[require.resolve(pluginFile)];
                    const updatedPlugin = require(pluginFile);
                    const commands = Array.isArray(updatedPlugin.command) ? updatedPlugin.command : [updatedPlugin.command];
                    
                    await sock.sendMessage(from, { 
                        text: `Plugin "${pluginName}" updated successfully!\n\n` +
                              `Commands: ${commands.join(', ')}\n` +
                              `Description: ${updatedPlugin.description || 'No description'}\n` +
                              `Plugin reloaded and ready to use.` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { 
                        text: `Plugin "${pluginName}" updated but reload failed. Restart bot to apply changes.` 
                    }, { quoted: msg });
                }
            } catch (reloadError) {
                console.error("Reload error:", reloadError);
                await sock.sendMessage(from, { 
                    text: `⚠️ Plugin "${pluginName}" updated but reload failed. Restart bot. Error: ${reloadError.message}` 
                }, { quoted: msg });
            }

            // Clean up old backups (keep only last 3)
            try {
                const backups = fs.readdirSync(backupDir)
                    .filter(f => f.startsWith(`${pluginName}_backup_`) && f.endsWith('.js'))
                    .sort()
                    .reverse();
                
                if (backups.length > 3) {
                    for (let i = 3; i < backups.length; i++) {
                        fs.unlinkSync(path.join(backupDir, backups[i]));
                    }
                }
            } catch (backupError) {
                console.log("Backup cleanup error:", backupError);
            }

        } catch (error) {
            console.error("Updateplugin error:", error.message);
            
            let errorMessage = `❌ Failed to update plugin "${pluginName}": `;
            
            if (error.code === 'ENOTFOUND') {
                errorMessage += "URL not found or network error.";
            } else if (error.response?.status === 404) {
                errorMessage += "Plugin URL not found (404).";
            } else if (error.response?.status === 403) {
                errorMessage += "Access forbidden (403). Check if the URL is public.";
            } else {
                errorMessage += error.message;
            }
            
            await sock.sendMessage(from, { 
                text: errorMessage 
            }, { quoted: msg });
        }
    }
};