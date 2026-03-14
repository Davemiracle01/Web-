const { getContentType } = require("@whiskeysockets/baileys");

function normalizeJid(rawJid) {
    if (!rawJid) return { raw: null, resolved: null, isResolved: false, isLid: false };
    const isLid = rawJid.includes('@lid');
    const resolved = isLid ? rawJid.replace('@lid', '@s.whatsapp.net') : rawJid;
    return {
        raw: rawJid,
        resolved,
        isResolved: rawJid === resolved,
        isLid
    };
}

module.exports = {
    command: ['debug', 'dump', 'raw'],
    description: 'Detailed message info',

    run: async ({ sock, msg, from, sender, isGroup }) => {
        try {
            let m = Array.isArray(msg.messages) ? msg.messages[0] : msg;

            if (!m?.message) {
                await sock.sendMessage(from, {
                    text: `\`\`\`DEBUG DUMP\`\`\`\n\`\`\`${JSON.stringify(msg, null, 2)}\n\`\`\``
                }, { quoted: msg });
                return;
            }

            // pick target message (main or quoted)
            let targetMsg = m;
            const quotedInfo = m.message?.extendedTextMessage?.contextInfo;

            let quotedDump = null;
            if (quotedInfo?.quotedMessage) {
                const quotedType = getContentType(quotedInfo.quotedMessage);
                const quotedText =
                    quotedType === "conversation"
                        ? quotedInfo.quotedMessage.conversation
                        : quotedType === "extendedTextMessage"
                        ? quotedInfo.quotedMessage.extendedTextMessage?.text
                        : quotedType === "imageMessage"
                        ? quotedInfo.quotedMessage.imageMessage?.caption || "[image]"
                        : quotedType === "videoMessage"
                        ? quotedInfo.quotedMessage.videoMessage?.caption || "[video]"
                        : `[${quotedType}]`;

                quotedDump = {
                    id: quotedInfo.stanzaId,
                    sender: normalizeJid(quotedInfo.participant || quotedInfo.remoteJid),
                    type: quotedType,
                    text: quotedText
                };
            }

            // main message
            const type = getContentType(targetMsg.message);
            const text =
                type === "conversation"
                    ? targetMsg.message.conversation
                    : type === "extendedTextMessage"
                    ? targetMsg.message.extendedTextMessage?.text
                    : type === "imageMessage"
                    ? targetMsg.message.imageMessage?.caption || "[image]"
                    : type === "videoMessage"
                    ? targetMsg.message.videoMessage?.caption || "[video]"
                    : `[${type}]`;

            const dump = {
                chatType: isGroup ? "group" : "private",
                remoteJid: targetMsg.key?.remoteJid,
                sender: normalizeJid(targetMsg.key?.participant || targetMsg.key?.remoteJid),
                fromMe: targetMsg.key?.fromMe || false,
                pushName: targetMsg.pushName || "Unknown",
                messageId: targetMsg.key?.id,
                timestamp: targetMsg.messageTimestamp,
                messageType: type,
                messageText: text,
                quoted: quotedDump
            };

            const output = `\`\`\`DEBUG DUMP\`\`\`\n${JSON.stringify(dump, null, 2)}`;

            await sock.sendMessage(from, { text: output }, { quoted: msg });

            // log full structure in console for devs
            console.dir(targetMsg, { depth: 5, colors: true });

        } catch (err) {
            console.error("debug error", err);
            await sock.sendMessage(from, {
                text: `\`\`\`DEBUG ERROR\`\`\`\n\`\`\`${err.message}\`\`\``
            }, { quoted: msg });
        }
    }
};