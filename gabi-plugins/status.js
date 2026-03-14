const { react01 } = require('../lib/extra');
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const BANNER_URL = "https://i.imgur.com/4YPEQV1.png";
const GITHUB_URL = "https://github.com/Gabimaru-Dev";

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🖥️ System Status" }
  };
}

module.exports = {
  command: ["status", "sysinfo", "info"],
  description: "Full bot & system status panel",
  isSudo: true,

  async run({ sock, msg, from, settings }) {
    await react01(sock, from, msg.key, 1000);

    // ── Gather stats ───────────────────────────────────────────────────────────
    const uptime    = process.uptime();
    const uH = Math.floor(uptime / 3600);
    const uM = Math.floor((uptime % 3600) / 60);
    const uS = Math.floor(uptime % 60);
    const uStr = `${String(uH).padStart(2,"0")}h ${String(uM).padStart(2,"0")}m ${String(uS).padStart(2,"0")}s`;

    const mem       = process.memoryUsage();
    const memUsed   = (mem.heapUsed  / 1024 / 1024).toFixed(1);
    const memTotal  = (mem.heapTotal / 1024 / 1024).toFixed(1);
    const rss       = (mem.rss       / 1024 / 1024).toFixed(1);
    const sysRam    = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const sysRamF   = (os.freemem()  / 1024 / 1024 / 1024).toFixed(2);
    const cpus      = os.cpus();
    const cpuModel  = cpus[0]?.model?.split(" ").slice(0, 4).join(" ") || "Unknown";
    const cpuCores  = cpus.length;
    const platform  = os.platform();
    const arch      = os.arch();
    const nodeVer   = process.version;
    const hostname  = os.hostname();

    const botName   = settings.botName || settings.packname || "Gabimaru";
    const prefix    = settings.prefix;
    const sudoCount = (settings.sudo || []).length;

    // Plugin count
    const pluginsDir = path.join(__dirname);
    const pluginCount = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".js") && f !== "chatbot.js").length;

    const modeStr   = sock.public ? "🌐 Public" : "🔒 Self";
    const now       = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
    const pid       = process.pid;

    const text =
      `🖥️ *${botName} — System Status*\n\n` +
      `╔══ 🤖 *Bot Info*\n` +
      `║  Name: ${botName}\n` +
      `║  Prefix: \`${prefix}\`\n` +
      `║  Mode: ${modeStr}\n` +
      `║  Plugins: ${pluginCount}\n` +
      `║  Sudo Users: ${sudoCount}\n` +
      `╠══ 🕐 *Runtime*\n` +
      `║  Uptime: ${uStr}\n` +
      `║  PID: ${pid}\n` +
      `║  Node.js: ${nodeVer}\n` +
      `╠══ 💾 *Memory*\n` +
      `║  Heap: ${memUsed}MB / ${memTotal}MB\n` +
      `║  RSS: ${rss}MB\n` +
      `║  System RAM: ${sysRamF}GB free / ${sysRam}GB total\n` +
      `╠══ ⚡ *CPU & OS*\n` +
      `║  CPU: ${cpuModel} (${cpuCores} cores)\n` +
      `║  Platform: ${platform} ${arch}\n` +
      `║  Host: ${hostname}\n` +
      `╚══ 🗓️ ${now}`;

    // ── Style 5 — Status banner ────────────────────────────────────────────────
    await sock.sendMessage(from, {
      text,
      contextInfo: {
        externalAdReply: {
          showAdAttribution: false,
          renderLargerThumbnail: true,
          title: `${botName} — System Status 🖥️`,
          body: `Uptime: ${uStr}  •  RAM: ${memUsed}MB  •  ${pluginCount} plugins`,
          previewType: "PHOTO",
          thumbnailUrl: BANNER_URL,
          sourceUrl: GITHUB_URL,
          mediaUrl:  GITHUB_URL,
          mediaType: 1
        }
      }
    }, { quoted: fakeQuote(from) });

    // ── Style 3 — Quick bot actions ────────────────────────────────────────────
    const sections = [
      {
        title: "⚡ Quick Actions",
        rows: [
          { title: "🏓 Ping / Speed Test", rowId: `${prefix}ping`,      description: "Check response speed" },
          { title: "🟢 Alive Check",        rowId: `${prefix}alive`,     description: "Full uptime & system info" },
          { title: "🌐 Set Public Mode",    rowId: `${prefix}public`,    description: "Allow all users to use bot" },
          { title: "🔒 Set Self Mode",      rowId: `${prefix}self`,      description: "Restrict bot to owner only" },
        ]
      },
      {
        title: "👑 Management",
        rows: [
          { title: "📋 Full Menu",          rowId: `${prefix}menu`,      description: "Open command browser" },
          { title: "👥 Sudo List",          rowId: `${prefix}listsudo`,  description: "View and manage sudo users" },
          { title: "🔄 Reload Plugins",     rowId: `${prefix}listplugin`,description: "Scan loaded plugins" },
        ]
      }
    ];

    await sock.sendMessage(from, {
      text: `*Quick Actions*\n\nTap any row below to execute it instantly.`,
      footer: `${botName}  •  system panel`,
      title: "🖥️ System Panel",
      buttonText: "🔽  Quick Actions",
      sections,
      listType: 1
    }, { quoted: msg });
  }
};
