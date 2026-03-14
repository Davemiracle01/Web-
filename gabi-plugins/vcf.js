const fs = require("fs");
const path = require("path");
const { react01 } = require('../lib/extra');
module.exports = {
  command: ["vcf"],
  description: "Export group members as VCF contact file",
  isGroup: true,
  
  async run({ sock, msg, from }) {
    try {
    await react01(sock, from, msg.key, 2000);
      await sock.sendMessage(from, { text: "Creating VCF, please wait..." }, { quoted: msg });

      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata.participants;

      if (!participants || participants.length === 0) {
        return sock.sendMessage(from, { text: "❌ No members found." }, { quoted: msg });
      }

      let vcfContent = "";

      for (const p of participants) {
        const jid = p.id;
        const num = jid.split("@")[0];
        let contact;

        try {
          const res = await sock.onWhatsApp(jid);
          contact = res?.[0];
        } catch {
          contact = null;
        }

        const pushName = contact?.notify || contact?.name || `+${num}`;
        const uuser = `🤺 ${pushName}`;

        vcfContent += `BEGIN:VCARD\nVERSION:3.0\nFN:${uuser}\nTEL;TYPE=CELL:+${num}\nEND:VCARD\n\n`;
      }

      const fileName = `group_contacts_${Date.now()}.vcf`;
      const tempDir = path.join(__dirname, "..", "temp");

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, vcfContent.trim());

      await sock.sendMessage(from, {
        document: fs.readFileSync(filePath),
        fileName,
        mimetype: "text/vcard",
        caption: `📇 VCF Generated.\n👥 Total: ${participants.length} members`
      }, { quoted: msg });

      fs.unlinkSync(filePath); // Clean up

    } catch (err) {
      console.error("VCF error:", err);
      sock.sendMessage(from, { text: "❌ Failed to generate VCF file." }, { quoted: msg });
    }
  }
};