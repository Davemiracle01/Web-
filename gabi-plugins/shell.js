const { exec } = require("child_process");

module.exports = {
  command: "$",
  isSudo: true,
  description: "Execute shell commands",

  async run({ sock, msg, from, text }) {
    const send = (content) => sock.sendMessage(from, { text: String(content) }, { quoted: msg });

    exec(text, (err, stdout, stderr) => {
      if (err) return send("❌ " + err.message);
      if (stderr) return send("⚠️ " + stderr);

      if (stdout.length > 4000) {
        const fs = require("fs");
        const tmp = require('path').join(__dirname, '..', 'shell_output.txt');
        fs.writeFileSync(tmp, stdout);
        sock.sendMessage(from, { document: { url: tmp }, mimetype: "text/plain", fileName: "output.txt" }, { quoted: msg });
        fs.unlinkSync(tmp);
      } else {
        send(stdout || "✅ Done.");
      }
    });
  }
};