const { react01 } = require('../lib/extra');

module.exports = {
  command: ["kickall"],
  description: "Remove all non-admin members from group",
  isGroup: true,
  isAdmin: true,
  isSudo: true,

  async run({ sock, msg, from }) {
    try {
    await react01(sock, from, msg.key, 2000);
      const metadata = await sock.groupMetadata(from);
      const participants = metadata.participants;

      const admins = participants.filter(p => p.admin).map(p => p.id);
      const kickList = participants
        .map(p => p.id)
        .filter(id => !admins.includes(id) && id !== sock.user.id);

      if (!kickList.length) {
        return sock.sendMessage(from, { text: "✅ No non-admins to kick." }, { quoted: msg });
      }

      for (let i = 0; i < kickList.length; i++) {
        await sock.groupParticipantsUpdate(from, [kickList[i]], "remove");
        await new Promise(res => setTimeout(res, 1000)); // avoid flood
      }

      await sock.sendMessage(from, { text: "✅ Successfully kicked all non-admin members." }, { quoted: msg });
    } catch (e) {
      console.error(e);
      await sock.sendMessage(from, { text: "⚠️ Failed to kick members." }, { quoted: msg });
    }
  }
};