const util = require("util");

module.exports = {
  command: ">", 
  isSudo: true,
  description: "JS evaluation",

  async run({ sock, msg, from, text }) {
    const send = (content) => sock.sendMessage(from, { text: String(content) }, { quoted: msg });

    try {
      let result = await eval(text);
      if (typeof result !== "string") {
        result = util.inspect(result, { depth: 1 });
      }

      if (result.length > 4000) {
        const fs = require("fs");
        const tmp = "./eval_output.txt";
        fs.writeFileSync(tmp, result);
        await sock.sendMessage(from, { document: { url: tmp }, mimetype: "text/plain", fileName: "output.txt" }, { quoted: msg });
        fs.unlinkSync(tmp);
      } else {
        send(result);
      }
    } catch (e) {
      send("❌ " + e.message);
    }
  }
};