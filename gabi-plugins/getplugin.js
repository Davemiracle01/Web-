
const fs = require("fs");
const path = require("path");

module.exports = {
  command: ["getplugin", "fetchplugin"],
  description: "Get the source code of a plugin",
  isSudo: true,

  async run({ sock, msg, from, args }) {
    try {
      if (!args[0]) {
        return sock.sendMessage(from, { text: "⚠️ Usage: getplugin <name>" }, { quoted: msg });
      }

      const pluginName = args[0].toLowerCase();
      const pluginPath = path.join(__dirname, `${pluginName}.js`);

      if (!fs.existsSync(pluginPath)) {
        return sock.sendMessage(from, { text: `Plugin '${pluginName}' not found.` }, { quoted: msg });
      }

      await sock.sendMessage(from, {
        document: { url: pluginPath },
        mimetype: "application/javascript",
        fileName: `${pluginName}.js`,
        caption: `Plugin: ${pluginName}.js`
      }, { quoted: msg });

    } catch (err) {
      console.error("GetPlugin error:", err);
      return sock.sendMessage(from, { text: "❌ Failed to send plugin." }, { quoted: msg });
    }
  }
};