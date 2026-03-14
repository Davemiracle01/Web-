const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { react01, error01 } = require('../lib/extra');

module.exports = {
    command: ["plugin", "addplugin"],
    description: "Download and install a new plugin from GitHub/Gist URL",
    isOwner: true,

    async run({ sock, msg, from, args, text, isOwner, settings }) {
        await react01(sock, from, msg.key, 2000);

        if (args.length < 1) {
            return sock.sendMessage(from, { 
                text: `❌ Usage: ${settings.prefix}addplugin <plugin_url>\n\nSupported URLs:\n• Raw GitHub file: https://raw.githubusercontent.com/\n• GitHub Gist: https://gist.github.com/\n• Raw Gist: https://gist.githubusercontent.com/user/gist_id/raw/...` 
            }, { quoted: msg });
        }

        let pluginUrl = args[0];
        const pluginsDir = path.join(__dirname);
        if (pluginUrl.includes('gist.github.com') && !pluginUrl.includes('/raw/')) {
            const gistMatch = pluginUrl.match(/gist\.github\.com\/([^\/]+\/)?([a-f0-9]+)/i);
            if (gistMatch && gistMatch[2]) {
                const gistId = gistMatch[2];
                pluginUrl = `https://gist.githubusercontent.com/${gistMatch[1] || ''}${gistId}/raw`;
            }
        }

        try {
            const response = await axios.get(pluginUrl, { 
                timeout: 15000,
                headers: { 'User-Agent': 'WhatsApp-Bot-Plugin-Loader' }
            });
            
            const pluginCode = response.data;
            
            if (!pluginCode || pluginCode.trim().length === 0) {
                return sock.sendMessage(from, { 
                    text: "❌ Downloaded file is empty." 
                }, { quoted: msg });
            }

            // Extract plugin name
            let pluginName = "unknown-plugin";
            const commandMatch = pluginCode.match(/command:\s*(\[.*?\]|["'][^"']+["'])/i);
            if (commandMatch) {
                try {
                    let commands = commandMatch[1];
                    if (commands.startsWith('[')) {
                        const cmdArray = JSON.parse(commands.replace(/'/g, '"'));
                        pluginName = Array.isArray(cmdArray) ? cmdArray[0] : cmdArray;
                    } else {
                        pluginName = commands.replace(/["']/g, '');
                    }
                } catch (e) {
                    pluginName = commands.replace(/[\[\]"']/g, '').split(',')[0].trim();
                }
            }
            
            if (pluginName === "unknown-plugin") {
                const urlMatch = pluginUrl.match(/\/([^\/]+)\.js/);
                pluginName = urlMatch ? urlMatch[1] : `plugin-${Date.now()}`;
            }

            pluginName = pluginName.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
            const pluginFile = path.join(pluginsDir, `${pluginName}.js`);
            
            // Save the plugin
            fs.writeFileSync(pluginFile, pluginCode);
            
            // Auto-reload plugins using the global function
            try {
                if (typeof global.loadPlugins === 'function') {
                    global.loadPlugins(); // This will reload all plugins
                    await sock.sendMessage(from, { 
                        text: `✅ Plugin "${pluginName}" added and reloaded successfully!\n\nUse ${settings.prefix}${pluginName} to test it.` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { 
                        text: `✅ Plugin "${pluginName}" saved. Restart bot to use it. (loadPlugins function not found)` 
                    }, { quoted: msg });
                }
            } catch (reloadError) {
                console.error("Reload error:", reloadError);
                await sock.sendMessage(from, { 
                    text: `✅ Plugin "${pluginName}" saved but reload failed. Restart bot. Error: ${reloadError.message}` 
                }, { quoted: msg });
            }

        } catch (error) {
            console.error("Addplugin error:", error.message);
            await sock.sendMessage(from, { 
                text: `❌ Failed to download plugin: ${error.message}` 
            }, { quoted: msg });
        }
    }
};