const { react01 } = require('../lib/extra');

module.exports = {
  command: ["setname"],
  description: "Change group name",
  isGroup: true,
  isAdmin: true,
  
  async run({ sock, msg, from, text }) {
  
  await react01(sock, from, msg.key, 2000);
    const name = text;
    if (!name) {
      return sock.sendMessage(from, { text: "✏️ Enter a new group name\n .setname example-usage" }, { quoted: msg });
    }

    await sock.groupUpdateSubject(from, name);
    sock.sendMessage(from, { text: `✅ Group name updated.` }, { quoted: msg });
  }
};