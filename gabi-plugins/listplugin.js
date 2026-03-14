const fs = require("fs");
const path = require("path");
const { react01, error01 } = require('../lib/extra');

module.exports = {
  command: ["listplugin", "plugins", "plist"],
  description: "List all available plugins",
  isSudo: true,

  async run({ sock, msg, from, args, settings }) {
    try {
      await react01(sock, from, msg.key, 1500);
      
      const pluginsDir = path.join(__dirname);
      const files = fs.readdirSync(pluginsDir);
      const pluginFiles = files.filter(file => 
        file.endsWith('.js') && 
        file !== 'listplugin.js' && 
        file !== 'telestick.js'
      );
      
      if (pluginFiles.length === 0) {
        return sock.sendMessage(from, { 
          text: "📂 No plugins found." 
        }, { quoted: msg });
      }
      
      pluginFiles.sort();
      
      let pluginList = "*Available Plugins:*\n\n";
      pluginFiles.forEach((file, index) => {
        const pluginName = file.replace('.js', '');
        pluginList += `${index + 1}. ${pluginName}\n`;
      });
      
      pluginList += `\nTotal Plugins: ${pluginFiles.length} plugins`;
      pluginList += `\nUse: *${settings.prefix}getplugin <name>* to download a plugin`;
      
      await sock.sendMessage(from, { 
        text: pluginList 
      }, { quoted: msg });

    } catch (err) {
      console.error("ListPlugin error:", err);
      return sock.sendMessage(from, { 
        text: "❌ Failed to list plugins." 
      }, { quoted: msg });
    }
  }
};