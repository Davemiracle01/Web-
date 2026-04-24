/**
 * gabi-plugins/menu.js  —  Redesigned Menu
 *
 * Design contract:
 *   • HEADER  → status-panel style (╔/║/╚ borders) + externalAdReply card
 *   • COMMAND LIST → WhatsApp list message so each row is tappable
 *   • Each category is a section in the list — no wall of text
 *   • Audio rotation unchanged from original
 */

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const { react01 } = require("../lib/extra");

const BANNER_URL = "https://files.catbox.moe/je5v6y.jpeg";
const GITHUB_URL = "https://github.com/Davemiracle01/";
const MEDIA_DIR  = path.join(__dirname, "../media");

// ── Audio rotation ─────────────────────────────────────────────────────────────
const audioState = { queue: [], played: [] };

function getNextAudio() {
  if (!fs.existsSync(MEDIA_DIR)) return null;
  const all = fs.readdirSync(MEDIA_DIR)
    .filter(f => f.toLowerCase().endsWith(".mp3"))
    .map(f => path.join(MEDIA_DIR, f));
  if (!all.length) return null;
  if (all.length === 1) return all[0];
  if (!audioState.queue.length) {
    const remaining = all.filter(f => !audioState.played.includes(f));
    const pool = remaining.length ? remaining : all;
    if (!remaining.length) audioState.played = [];
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    audioState.queue = shuffled;
  }
  const next = audioState.queue.shift();
  audioState.played.push(next);
  return next;
}

// ── Category config ────────────────────────────────────────────────────────────
const CATEGORY_CONFIG = [
  { key: "fun",      label: "🎭 Fun & Media",    cmds: ["waifu","nwaifu","sticker","take","wasted","animechar","animu","textfx","bible","react","tourl","tts","telesticker"] },
  { key: "download", label: "📥 Downloaders",    cmds: ["tiktok","play","pinterest","ttsearch"] },
  { key: "group",    label: "👥 Group Tools",    cmds: ["tagall","hidetag","welcome","linkgc","acceptreq","antilink","chatId"] },
  { key: "admin",    label: "🛡️ Admin Tools",    cmds: ["kick","kickall","promote","demote","mute","unmute","setdesc","hijack","leave"] },
  { key: "sudo",     label: "⚙️ Bot Settings",   cmds: ["public","self","setprefix","setname","chatbot","addsudo","delsudo","listsudo","alive","ping","status","persona","block","rvo","addplug","getplugin","updateplugin","listplugin","keepalive","debug"] },
  { key: "owner",    label: "👑 Owner Only",      cmds: [">","$","eval","eval-async","shell","ddos","ddos2"] },
];

function getCategory(mainCmd) {
  for (const cfg of CATEGORY_CONFIG) {
    if (cfg.cmds.includes(mainCmd)) return cfg;
  }
  return { key: "general", label: "🌐 General" };
}

function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🕸️ Gabimaru Bot" }
  };
}

// ── System helpers (same as status.js) ────────────────────────────────────────
function getUptimeStr() {
  const u  = process.uptime();
  const uH = Math.floor(u / 3600);
  const uM = Math.floor((u % 3600) / 60);
  const uS = Math.floor(u % 60);
  return `${String(uH).padStart(2,"0")}h ${String(uM).padStart(2,"0")}m ${String(uS).padStart(2,"0")}s`;
}

// ── Module export ──────────────────────────────────────────────────────────────
module.exports = {
  command:     ["menu", "help", "cmd", "commands"],
  description: "Bot status panel + interactive command browser",

  async run({ sock, msg, from, settings, isOwner, isSudo }) {
    try {
      await react01(sock, from, msg.key, 500);

      // ── Scan plugins ─────────────────────────────────────────────────────────
      const pluginsDir  = path.join(__dirname);
      const pluginFiles = fs.readdirSync(pluginsDir)
        .filter(f => f.endsWith(".js") && !["menu.js","chatbot.js"].includes(f));

      const allPlugins = [];
      for (const file of pluginFiles) {
        try {
          const pp = path.join(pluginsDir, file);
          delete require.cache[require.resolve(pp)];
          const p = require(pp);
          if (!p.command) continue;
          const aliases = Array.isArray(p.command) ? p.command : [p.command];
          allPlugins.push({
            mainCmd:     aliases[0],
            aliases,
            description: p.description || p.desc || "No description",
            isOwner:     !!p.isOwner,
            isSudo:      !!p.isSudo,
          });
        } catch {}
      }

      // ── Build category buckets ───────────────────────────────────────────────
      const allCats   = [...CATEGORY_CONFIG, { key: "general", label: "🌐 General", cmds: [] }];
      const buckets   = Object.fromEntries(allCats.map(c => [c.key, []]));
      const inAnyList = new Set(CATEGORY_CONFIG.flatMap(c => c.cmds));

      for (const plugin of allPlugins) {
        const cat = getCategory(plugin.mainCmd);
        if (!inAnyList.has(plugin.mainCmd)) {
          buckets["general"].push(plugin);
        } else {
          (buckets[cat.key] = buckets[cat.key] || []).push(plugin);
        }
      }

      const totalPlugins  = allPlugins.length;
      const totalCommands = allPlugins.reduce((n, p) => n + p.aliases.length, 0);

      const botName = settings.botName || settings.packname || "Gabimaru";
      const prefix  = settings.prefix || ".";
      const now     = new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });

      // ── System stats (mirrors status.js) ─────────────────────────────────────
      const mem      = process.memoryUsage();
      const memUsed  = (mem.heapUsed  / 1024 / 1024).toFixed(1);
      const memTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
      const sysRam   = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
      const sysRamF  = (os.freemem()  / 1024 / 1024 / 1024).toFixed(2);
      const cpuModel = os.cpus()[0]?.model?.split(" ").slice(0, 3).join(" ") || "Unknown";
      const uptimeStr = getUptimeStr();
      const modeStr  = sock.public ? "🌐 Public" : "🔒 Self";
      const sudoCnt  = (settings.sudo || []).length;

      // ── STATUS-PANEL STYLE header text ────────────────────────────────────────
      const headerText =
        `╔══ 🤖 *${botName}*\n` +
        `║  Prefix: \`${prefix}\`  •  Mode: ${modeStr}\n` +
        `║  Plugins: ${totalPlugins}  •  Commands: ${totalCommands}\n` +
        `║  Sudo users: ${sudoCnt}\n` +
        `╠══ 🕐 *Runtime*\n` +
        `║  Uptime: ${uptimeStr}\n` +
        `║  Node.js: ${process.version}\n` +
        `╠══ 💾 *System*\n` +
        `║  Heap: ${memUsed}MB / ${memTotal}MB\n` +
        `║  RAM: ${sysRamF}GB free / ${sysRam}GB total\n` +
        `║  CPU: ${cpuModel}\n` +
        `╚══ 🗓️ ${now}\n\n` +
        `_Tap a command in the list below to run it._`;

      // ── Send header as AD-REPLY card (like alive.js / status.js) ─────────────
      await sock.sendMessage(from, {
        text: headerText,
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            renderLargerThumbnail: true,
            title:       `${botName} 🕷️ — Command Menu`,
            body:        `${totalPlugins} plugins  •  ${totalCommands} commands  •  Prefix: ${prefix}`,
            previewType: "PHOTO",
            thumbnailUrl: BANNER_URL,
            sourceUrl:    GITHUB_URL,
            mediaUrl:     GITHUB_URL,
            mediaType:   1,
          }
        }
      }, { quoted: fakeQuote(from) });

      // ── LIST MESSAGE — category browser (tappable rows) ──────────────────────
      const visibleCats = allCats.filter(cfg => {
        if (cfg.key === "owner" && !isOwner)              return false;
        if (cfg.key === "sudo"  && !isSudo && !isOwner)  return false;
        return buckets[cfg.key]?.length > 0;
      });

      const sections = visibleCats.map(cfg => ({
        title: cfg.label,
        rows: buckets[cfg.key]
          .sort((a, b) => a.mainCmd.localeCompare(b.mainCmd))
          .map(p => ({
            title:       `${prefix}${p.mainCmd}`,
            rowId:       `${prefix}${p.mainCmd}`,
            description: p.description.length > 72
              ? p.description.slice(0, 69) + "…"
              : p.description,
          }))
      }));

      await sock.sendMessage(from, {
        text:       `*${botName} — Browse Commands*\n\nTap any row to execute it instantly.\n\n_${totalPlugins} plugins  •  ${visibleCats.length} categories_`,
        footer:     `${botName}  •  tap to run`,
        title:      "📋 Command List",
        buttonText: "🔽 Browse Commands",
        sections,
        listType:   1,
      }, { quoted: msg });

      // ── Audio rotation ────────────────────────────────────────────────────────
      const audioFile = getNextAudio();
      if (audioFile) {
        const audioBuffer = fs.readFileSync(audioFile);
        await sock.sendMessage(from, {
          audio:    audioBuffer,
          mimetype: "audio/mpeg",
          ptt:      false,
        }, { quoted: msg });
      }

    } catch (error) {
      console.error("Menu error:", error);
      await sock.sendMessage(from, {
        text: `❌ Menu error: ${error.message}`
      }, { quoted: msg });
    }
  }
};
