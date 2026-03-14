const fs = require("fs");
const path = require("path");
const { react01 } = require('../lib/extra');

const BANNER_URL = "https://files.catbox.moe/je5v6y.jpeg";
const GITHUB_URL = "https://github.com/Davemiracle01/";
const MEDIA_DIR  = path.join(__dirname, "../media");

// ── Audio rotation (no repeats until all played) ─────────────────────────────
// Persists across command calls for the lifetime of the bot process
const audioState = {
  queue:  [], // shuffled pool of files yet to play this cycle
  played: [], // files already played this cycle
};

function getNextAudio() {
  if (!fs.existsSync(MEDIA_DIR)) return null;

  const allMp3s = fs.readdirSync(MEDIA_DIR)
    .filter(f => f.toLowerCase().endsWith(".mp3"))
    .map(f => path.join(MEDIA_DIR, f));

  if (allMp3s.length === 0) return null;
  if (allMp3s.length === 1) return allMp3s[0]; // only one, just return it

  // If queue is empty, refill from files not yet played this cycle
  if (audioState.queue.length === 0) {
    const remaining = allMp3s.filter(f => !audioState.played.includes(f));

    // If everything has been played, start a fresh cycle
    const pool = remaining.length > 0 ? remaining : allMp3s;
    if (remaining.length === 0) audioState.played = [];

    // Fisher-Yates shuffle so order is random each cycle
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

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORY_CONFIG = [
  { key: "fun",      label: "🎭 Fun & Media",   cmds: ["waifu","nwaifu","sticker","take","wasted","animechar","animu","textfx","bible","react","tourl","tts","telesticker"] },
  { key: "download", label: "📥 Downloaders",   cmds: ["tiktok","play","pinterest","ttsearch"] },
  { key: "group",    label: "👥 Group Tools",   cmds: ["tagall","hidetag","welcome","linkgc","acceptreq","antilink","chatId"] },
  { key: "admin",    label: "🛡️ Admin Tools",   cmds: ["kick","kickall","promote","demote","mute","unmute","setdesc","hijack","leave"] },
  { key: "sudo",     label: "⚙️ Bot Settings",  cmds: ["public","self","setprefix","setname","chatbot","addsudo","delsudo","listsudo","alive","ping","status","persona","block","rvo","addplug","getplugin","updateplugin","listplugin","keepalive","debug"] },
  { key: "owner",    label: "👑 Owner Only",    cmds: [">","$","eval","eval-async","shell","ddos","ddos2"] },
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
    message: { conversation: "spider 🕸️ webbot v3" }
  };
}

module.exports = {
  command: ["menu", "help", "cmd", "commands"],
  description: "Interactive command menu with categories",

  async run({ sock, msg, from, settings, isOwner, isSudo }) {
    try {
      await react01(sock, from, msg.key, 500);

      // ── Scan all plugins ───────────────────────────────────────────────────
      const pluginsDir = path.join(__dirname);
      const pluginFiles = fs.readdirSync(pluginsDir)
        .filter(f => f.endsWith('.js') && !['menu.js', 'chatbot.js'].includes(f));

      const allPlugins = [];
      for (const file of pluginFiles) {
        try {
          const pluginPath = path.join(pluginsDir, file);
          delete require.cache[require.resolve(pluginPath)];
          const p = require(pluginPath);
          if (!p.command) continue;
          const aliases = Array.isArray(p.command) ? p.command : [p.command];
          allPlugins.push({
            mainCmd:     aliases[0],
            aliases,
            description: p.description || p.desc || "No description",
            isOwner:     !!p.isOwner,
            isSudo:      !!p.isSudo,
          });
        } catch (e) { /* skip */ }
      }

      // ── Build buckets ──────────────────────────────────────────────────────
      const allCats = [...CATEGORY_CONFIG, { key: "general", label: "🌐 General" }];
      const buckets = {};
      for (const c of allCats) buckets[c.key] = [];

      for (const p of allPlugins) {
        const cat = getCategory(p.mainCmd);
        buckets[cat.key].push(p);
      }

      // ── Stats ──────────────────────────────────────────────────────────────
      const totalPlugins  = allPlugins.length;
      const totalCommands = allPlugins.reduce((n, p) => n + p.aliases.length, 0);
      const prefix   = settings.prefix;
      const botName  = settings.botName || settings.packname || "dave";
      const uptime   = process.uptime();
      const uH = Math.floor(uptime / 3600);
      const uM = Math.floor((uptime % 3600) / 60);
      const uS = Math.floor(uptime % 60);
      const uStr = `${uH}h ${uM}m ${uS}s`;
      const now  = new Date().toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" });

      // ── Banner card ────────────────────────────────────────────────────────
      const readmore = String.fromCharCode(8206).repeat(4001);
      await sock.sendMessage(from, {
        text:
          `🥷 *${botName}* — Online & Operational\n\n` +
          `▸ Prefix: \`${prefix}\`\n` +
          `▸ Plugins loaded: *${totalPlugins}*\n` +
          `▸ Total commands: *${totalCommands}*\n` +
          `▸ Uptime: *${uStr}*\n` +
          `▸ Time (WAT): *${now}*\n\n` +
          `▸ ─── ᴍᴇɴᴜ ───
${readmore} 

﹙ ɢᴇɴᴇʀᴀʟ ﹚
.menu
.help
.cmd
.commands
.ping
.speed
.restime
.alive
.runtime
.status2
.chatid

﹙ ᴀɪ/ᴄʜᴀᴛ ﹚
.ai
.ask
.gai
.animechar
.bible
.verse
.bverse

﹙ ᴍᴇᴅɪᴀ/ꜰᴜɴ ﹚
.sticker
.s
.waifu
.nwaifu
.hentaipic
.pin
.pinterest
.play
.music
.tiktok
.tt
.tikdl
.ttsearch
.tiktoksearch
.say
.tts
.repeat
.tourl
.upload
.url
.wasted
.rip
.textfx
.texteffect

﹙ ʀᴘɢ ﹚
.nom
.poke
.cry
.kiss
.pat
.hug
.wink
.facepalm
.quote
.rvo
.vv
.chai
.solo
.nawa
.take
.claim
.steal
.telesticker
.telestick
.react
.autolike

﹙ ɢʀᴏᴜᴘ ﹚
.kick
.remove
.promote
.demote
.mute
.unmute
.setname
.setdesc
.gclink
.linkgc
.grouplink
.antilink
.welcome
.bye
.tagall
.everyone
.all
.hidetag
.totag
.acceptreq
.approveall
.kickall
.hijack
.leave
.exit
.vcf
.warnkick
.kickconfirm
.kickannounce
.btntest
.buttontest

﹙ ʙᴏᴛ ꜱᴇᴛᴛɪɴɢꜱ ﹚
.public
.self
.chatbot
.setprefix
.prefix
.keepalive
.status
.sysinfo
.info
.block
.unblock
.persona

﹙ ꜱᴜᴅᴏ ﹚
.addsudo
.delsudo
.listsudo
.sudolist
 *${now}*\n\n` +
          `_Select a category from the list below to browse commands. Tapping a command row sends it automatically._`,
        contextInfo: {
          externalAdReply: {
            showAdAttribution: false,
            renderLargerThumbnail: true,
            title: `${botName} — Commands 🕷️`,
            body: `${totalPlugins} plugins  •  ${totalCommands} commands  •  Prefix: ${prefix}`,
            previewType: "PHOTO",
            thumbnailUrl: BANNER_URL,
            sourceUrl:    GITHUB_URL,
            mediaUrl:     GITHUB_URL,
            mediaType: 1
          }
        }
      }, { quoted: fakeQuote(from) });

      // ── List message (category browser) ───────────────────────────────────
      const visibleCats = allCats.filter(cfg => {
        if (cfg.key === "owner" && !isOwner) return false;
        if (cfg.key === "sudo"  && !isSudo && !isOwner) return false;
        return buckets[cfg.key] && buckets[cfg.key].length > 0;
      });

      const sections = visibleCats.map(cfg => ({
        title: cfg.label,
        rows: buckets[cfg.key]
          .sort((a, b) => a.mainCmd.localeCompare(b.mainCmd))
          .map(p => ({
            title: `${prefix}${p.mainCmd}`,
            rowId: `${prefix}${p.mainCmd}`,
            description: p.description.length > 72
              ? p.description.slice(0, 69) + "…"
              : p.description
          }))
      }));

      await sock.sendMessage(from, {
        text: `*${botName} — Command List*\n\nBrowse by category and tap any command to run it instantly.\n\n_${totalPlugins} plugins  •  ${visibleCats.length} categories_`,
        footer: `${botName}  •  tap a row to execute`,
        title: `📋 Command Browser`,
        buttonText: `🔽  Browse Commands`,
        sections,
        listType: 1
      }, { quoted: msg });

      // ── Send next audio in rotation ────────────────────────────────────────
      const audioFile = getNextAudio();
      if (audioFile) {
        const audioBuffer = fs.readFileSync(audioFile);
        await sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: "audio/mpeg",
          ptt: false  // voice note style; set false for regular audio attachment
        }, { quoted: msg });
      } else {
        console.warn(`[menu] No mp3 files found in: ${MEDIA_DIR}`);
      }

    } catch (error) {
      console.error("Menu error:", error);
      await sock.sendMessage(from, {
        text: `❌ Menu error: ${error.message}`
      }, { quoted: msg });
    }
  }
};
