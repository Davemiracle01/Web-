const { react01 } = require('../lib/extra');
const os = require('os');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🥷 Gabimaru" }
  };
}

module.exports = {
  command: ["alive", "runtime", "status2"],
  description: "Check bot status with rich info card",

  async run({ sock, msg, from, settings }) {
    await react01(sock, from, msg.key, 1000);

    // ── Uptime ────────────────────────────────────────────────────────────────
    const uptime  = process.uptime();
    const uY  = Math.floor(uptime / (365 * 24 * 3600));
    const uMo = Math.floor((uptime % (365 * 24 * 3600)) / (30 * 24 * 3600));
    const uW  = Math.floor((uptime % (30 * 24 * 3600))  / (7 * 24 * 3600));
    const uD  = Math.floor((uptime % (7 * 24 * 3600))   / (24 * 3600));
    const uH  = Math.floor((uptime % (24 * 3600)) / 3600);
    const uM  = Math.floor((uptime % 3600) / 60);
    const uS  = Math.floor(uptime % 60);
    const parts = [];
    if (uY)  parts.push(`${uY}y`);
    if (uMo) parts.push(`${uMo}mo`);
    if (uW)  parts.push(`${uW}w`);
    if (uD)  parts.push(`${uD}d`);
    parts.push(`${String(uH).padStart(2,"0")}h:${String(uM).padStart(2,"0")}m:${String(uS).padStart(2,"0")}s`);
    const uptimeStr = parts.join(" ");

    // ── System ────────────────────────────────────────────────────────────────
    const memUsed  = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const memTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const cpuModel = os.cpus()[0]?.model?.split(" ").slice(0, 3).join(" ") || "Unknown";
    const platform = os.platform();
    const nodeVer  = process.version;
    const botName  = settings.botName || settings.packname || "Gabimaru";
    const prefix   = settings.prefix;
    const now      = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });

    const text =
      `🟢 *${botName}* is alive and running!\n\n` +
      `╔══ 🕐 *Runtime*\n` +
      `║  ${uptimeStr}\n` +
      `╠══ 💾 *System*\n` +
      `║  RAM: ${memUsed} MB used  •  ${memTotal} GB total\n` +
      `║  CPU: ${cpuModel}\n` +
      `║  OS: ${platform}  •  Node ${nodeVer}\n` +
      `╠══ 🤖 *Bot*\n` +
      `║  Prefix: \`${prefix}\`\n` +
      `║  Mode: ${sock.public ? "🌐 Public" : "🔒 Self"}\n` +
      `╚══ 🗓️ ${now}`;

    // ── Style 5 — Ad Reply card ───────────────────────────────────────────────
    await sock.sendMessage(from, {
      text,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: true,
          title: `${botName} 🥷 — Online`,
          body: `Uptime: ${uptimeStr}  •  RAM: ${memUsed}MB`,
          previewType: "PHOTO",
          thumbnailUrl: BANNER_URL,
          sourceUrl:    GITHUB_URL,
          mediaUrl:     GITHUB_URL,
          mediaType: 1
        }
      }
    }, { quoted: fakeQuote(from) });
  }
};
