const axios = require('axios')
module.exports = {
    command: ["wasted", "rip"],
    isGroup: true,

    async run({ sock, from, msg }) {
            const quotedInfo = msg.message.extendedTextMessage?.contextInfo;
            const mentionedJid = quotedInfo?.mentionedJid?.[0];
            const repliedToJid = quotedInfo?.participant;
            const targetJid = mentionedJid || repliedToJid;

            if (!targetJid) {

                return sock.sendMessage(from, { text: "You must @mention or reply to a user to waste them." }, { quoted: msg });

            }

            await sock.sendMessage(from, { react: { text: '🤹', key: msg.key } });

            const processingMsg = await sock.sendMessage(from, { text: `_I am on operation, please wait..._` }, { quoted: msg });
            let pfpUrl;
            try {
                pfpUrl = await sock.profilePictureUrl(targetJid, 'image');
            } catch {
                pfpUrl = 'https://i.imgur.com/4YPEQV1.png'; // default avatar fallback
            }

            const apiUrl = `https://some-random-api.com/canvas/overlay/wasted?avatar=${encodeURIComponent(pfpUrl)}`;

            const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });
            const caption = `*Wasted* : @${targetJid.split('@')[0]} ⚰️\n\n_My soul is empty._`;

            

            await sock.sendMessage(from, {

                image: response.data,

                caption: caption,

                mentions: [targetJid]

            }, { quoted: msg });

            await sock.sendMessage(from, { delete: processingMsg.key });
    }
};