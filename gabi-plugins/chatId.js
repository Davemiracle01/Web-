module.exports = {
  command: ["chatid"],
  description: "Get chat jid",
  async run({ sock, msg, readmore, from }) {
    const chatJid = `Jabber ID (JID) for this chat:`;
    const txt = chatJid+from;
    await sock.sendMessage(from, { text: txt }, { quoted: msg })
  }
}