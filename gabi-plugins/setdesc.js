const { react01 } = require('../lib/extra');

module.exports = {
  command: ["setdesc"],
  description: "Change group description",
  isGroup: true,
  isAdmin: true,

  async run({ sock, msg, from, text }) {
    await react01(sock, from, msg.key, 2000);
    const desc = text;
    if (!desc) {
      return sock.sendMessage(from, { text: "✏️ Enter a new group description." }, { quoted: msg });
    }

    await sock.groupUpdateDescription(from, desc);
    sock.sendMessage(from, { text: `✅ Group description updated.` }, { quoted: msg });
  }
};