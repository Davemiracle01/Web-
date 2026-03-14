const { react01 } = require('../lib/extra');

module.exports = {
  command: ["gclink", "linkgc", "grouplink"],
  description: "Get chat jid",
  isGroup: true,
  isAdmin: true,
  
  async run({ sock, msg, readmore, from }) {
  await react01(sock, from, msg.key, 2000);
    let response = await sock.groupInviteCode(from)
    const chatLink = `
    🎗️ *Group Link* 🎗️
The invite link for this group chat is: `;
    response = "https://chat.whatsapp.com/"+response || "🚫 Not found";
    const txt = chatLink+response;
    await sock.sendMessage(from, {
    image: { url: "https://mmg.whatsapp.net/o1/v/t24/f2/m231/AQNhnpCl3ufvtsRFd8wXb-Er1OQgDrabFkELPRdoeF2oV-_CC7LlXmuroIEyh-X3_nRoU_AEVFGq2RBmyQDp8UHGS2T8Rf3nbW1UulRLhA?ccb=9-4&oh=01_Q5Aa2QExIH4kzk9USpETX0aKN9QeIhHAItuPsY2jGBlhChLkbA&oe=68D95457&_nc_sid=e6ed6c&mms3=true" },
    caption: `${txt}`,
    contextInfo: {
      forwardingScore: 9,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363402888937015@newsletter",
        newsletterName: "Gabimaru Assistant 🥷",
      }
    }
  }, { quoted: msg });
  }
}