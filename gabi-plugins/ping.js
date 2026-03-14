const { react01 } = require('../lib/extra');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🥷 Gabimaru" }
  };
}

function getSpeedLabel(ms) {
  if (ms < 200)  return "⚡ Lightning";
  if (ms < 500)  return "🟢 Fast";
  if (ms < 1000) return "🟡 Normal";
  return "🔴 Slow";
}

module.exports = {
  command: ["ping", "speed", "restime"],
  description: "Check bot response speed",

  async run({ sock, msg, from, settings }) {
    await react01(sock, from, msg.key, 500);

    const start = Date.now();
    // Send a lightweight message to measure round-trip
    const probe = await sock.sendMessage(from, { text: "⏱️ Measuring response time..." }, { quoted: msg });
    const ms    = Date.now() - start;
    const label = getSpeedLabel(ms);

    // Delete probe message cleanly
    try { await sock.sendMessage(from, { delete: probe.key }); } catch (_) {}

    const botName = settings.botName || settings.packname || "Gabimaru";
    const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const uptime  = process.uptime();
    const uH = Math.floor(uptime / 3600);
    const uM = Math.floor((uptime % 3600) / 60);

    // ── Style 5 — Ad Reply result card ────────────────────────────────────────
    await sock.sendMessage(from, {
      text: `🏓 *Pong!*\n\n` +
            `▸ Response: *${ms}ms*  ${label}\n` +
            `▸ Memory: *${memUsed} MB*\n` +
            `▸ Uptime: *${uH}h ${uM}m*\n` +
            `▸ Mode: ${sock.public ? "🌐 Public" : "🔒 Self"}`,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: `${botName} — Response Speed`,
          body: `${ms}ms  ${label}`,
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
