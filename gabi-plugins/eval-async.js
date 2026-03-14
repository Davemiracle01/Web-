const util = require("util");

module.exports = {
  command: "=>", // trigger
  isSudo: true, // only owner can use
  description: "Async JS evaluation",

  async run({ sock, msg, from, text }) {
    const send = (content) => sock.sendMessage(from, { text: String(content) }, { quoted: msg });

    try {
      let result = await eval(`(async () => { return ${text} })()`);
      let output = util.format(result);
      if (output.length > 4000) {
        // Too long? send as file
        const fs = require("fs");
        const tmp = "./eval_async_output.txt";
        fs.writeFileSync(tmp, output);
        await sock.sendMessage(from, { document: { url: tmp }, mimetype: "text/plain", fileName: "output.txt" }, { quoted: msg });
        fs.unlinkSync(tmp);
      } else {
        send(output);
      }
    } catch (e) {
      send("❌ " + e.message);
    }
  }
};