const { react01 } = require('../lib/extra');

module.exports = {
  command: ["hijack"],
  description: "Make bot the only admin in the group",
  isGroup: true,
  isAdmin: true,
  isSudo: true,

  async run({ sock, msg, from }) {
    try {
    await react01(sock, from, msg.key, 2000);
      const metadata = await sock.groupMetadata(from);
      const participants = metadata.participants;

      const admins = participants.filter(p => p.admin).map(p => p.id);
      const toDemote = admins.filter(id => id !== sock.user.id);

      if (!toDemote.length) {
        return sock.sendMessage(from, { text: "✅ I'm already the only admin." }, { quoted: msg });
      }

      for (const adminId of toDemote) {
        await sock.groupParticipantsUpdate(from, [adminId], "demote");
        await new Promise(res => setTimeout(res, 800));
      }

      await sock.sendMessage(from, { text: "☑️ Hijacked! I'm the only admin now." }, { quoted: msg });

    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: "⚠️ Failed to hijack group." }, { quoted: msg });
    }
  }
};