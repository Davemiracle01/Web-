const fs = require('fs');
const path = require('path');
const antiLinkPath = path.join(__dirname, '../antilink.json');
const antiLinkDB = fs.existsSync(antiLinkPath) ? require(antiLinkPath) : {};
const { react01 } = require('../lib/extra');

module.exports = {
  command: ["antilink"],
  description: "Toggle anti-link on or off in a group",
  isGroup: true,
  isAdmin: true,

  async run({ msg, sock, from, args, text }) {
    const toggle = args[0]?.toLowerCase();
    if (!toggle || !["on", "off"].includes(toggle)) {
      return sock.sendMessage(from, {
        text: "⚙️ Usage: .antilink on | off"
      }, { quoted: msg });
    }

    if (toggle === "on") {
      antiLinkDB[from] = true;
    } else {
      delete antiLinkDB[from];
    }

    fs.writeFileSync(antiLinkPath, JSON.stringify(antiLinkDB, null, 2));
    
    await react01(sock, from, msg.key, 2000);
    await sock.sendMessage(from, {
      text: `🚫 Anti-link is now *${toggle.toUpperCase()}* for this group.`
    }, { quoted: msg });
  }
};