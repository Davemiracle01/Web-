const { react01 } = require('../lib/extra');

module.exports = {
  command: ["hidetag", "totag"],
  description: "Send any message mentioning everyone silently.",
  isGroup: true,
  isSudo: true,

  async run({ sock, msg, from, text }) {
    try {
    await react01(sock, from, msg.key, 2000);
      const metadata = await sock.groupMetadata(from);
      const members = metadata.participants.map(p => p.id);
      
      // CORRECT WAY to get quoted message
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;
      const isQuoted = Boolean(quotedMessage);

      // If the user replied to a message
      if (isQuoted && quotedMessage) {
        // Get the message type and content
        const type = Object.keys(quotedMessage)[0];
        const messageContent = quotedMessage[type];
        
        // Create message object based on type
        const messageObj = {
          [type]: messageContent,
          mentions: members
        };

        // Add caption if it exists (for media messages)
        if (messageContent.caption) {
          messageObj.caption = messageContent.caption;
        }

        // Send the quoted message back with mentions
        await sock.sendMessage(from, messageObj, {
          quoted: {
            key: {
              fromMe: false,
              participant: "0@s.whatsapp.net",
              remoteJid: from
            },
            message: {
              conversation: "🤺 HIDE TAG"
            }
          }
        });

      } else {
        // Fallback to text command
        const finalText = text.trim() !== "" ? text : "🍁 Salut!";
        
        await sock.sendMessage(from, {
          text: finalText,
          mentions: members
        });
      }

    } catch (err) {
      console.error("❌ Error in hidetag plugin:", err);
      await sock.sendMessage(from, { 
        text: "❌ Failed to send hidden tag. Make sure I'm admin and try again." 
      }, { quoted: msg });
    }
  }
};