/**
 * gabi.js — Gabimaru WhatsApp Bot Core Handler
 * v4.0 — Heroku-Optimized | Public Mode | Multi-Session
 * Owners: 254769279076, 254799073744
 */

const {
  getContentType,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");
const chalk     = require("chalk");
const moment    = require("moment-timezone");
const fs        = require("fs");
const https     = require("https");
const http      = require("http");
const path      = require("path");
const NodeCache = require("node-cache");
const Groq      = require("groq-sdk");

// Load settings with error handling
let settings = {};
try {
  settings = require("./settings.json");
} catch (error) {
  console.error(chalk.red("[ERROR] Failed to load settings.json:"), error.message);
  settings = {
    prefix: "!",
    botName: "spider🕷️",
    owner: "254769279076",
    sudo: [],
    packname: "Gabimaru"
  };
}

const { isChatbotDisabled } = require("./chatbot");
const { checkMonthYear } = require("./monthCheck");

// ─── Shared API Cache (5-min TTL) ─────────────────────────────────────────────
const apiCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

// ─── Shared Axios Instance ─────────────────────────────────────────────────────
const axios = require("axios").create({
  timeout: 12000,
  headers: { "User-Agent": "GabimaruBot/4.0" },
  httpsAgent: new https.Agent({ keepAlive: true }),
  httpAgent:  new http.Agent({ keepAlive: true }),
});

// ─── Anti-link DB ──────────────────────────────────────────────────────────────
const antiLinkPath = path.join(__dirname, "antilink.json");
let antiLinkDB = {};
try {
  if (fs.existsSync(antiLinkPath))
    antiLinkDB = JSON.parse(fs.readFileSync(antiLinkPath, "utf8"));
} catch (e) {
  console.error(chalk.yellow("[WARN] Failed to load antilink.json:"), e.message);
}

// ─── Sticker Folders ──────────────────────────────────────────────────────────
const inputFolder  = path.join(__dirname, "stick_input");
const outputFolder = path.join(__dirname, "stick_output");
try {
  if (!fs.existsSync(inputFolder))  fs.mkdirSync(inputFolder,  { recursive: true });
  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });
} catch (e) {
  console.error(chalk.yellow("[WARN] Failed to create sticker folders:"), e.message);
}

// ─── Plugin Loader ─────────────────────────────────────────────────────────────
const commands = new Map();

function loadPlugins() {
  const pluginsDir = path.join(__dirname, "gabi-plugins");
  console.log(chalk.blue(`[INFO] Looking for plugins in: ${pluginsDir}`));
  
  if (!fs.existsSync(pluginsDir)) {
    console.log(chalk.red(`[ERROR] Plugins directory not found: ${pluginsDir}`));
    console.log(chalk.yellow("[INFO] Creating plugins directory..."));
    try {
      fs.mkdirSync(pluginsDir, { recursive: true });
      console.log(chalk.green(`[INFO] Created plugins directory: ${pluginsDir}`));
    } catch (e) {
      console.error(chalk.red("[ERROR] Failed to create plugins directory:"), e.message);
    }
    return;
  }
  
  const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith(".js"));
  console.log(chalk.blue(`[INFO] Found ${files.length} plugin files`));
  
  if (files.length === 0) {
    console.log(chalk.yellow("[WARN] No plugin files found in gabi-plugins directory"));
    return;
  }
  
  let loadedCount = 0;
  for (const file of files) {
    try {
      const pluginPath = path.join(pluginsDir, file);
      console.log(chalk.blue(`[INFO] Loading plugin: ${file}`));
      
      // Clear require cache to allow hot reload
      delete require.cache[require.resolve(pluginPath)];
      const plugin = require(pluginPath);
      
      if (!plugin.command) {
        console.log(chalk.yellow(`[WARN] Plugin ${file} has no command property`));
        continue;
      }
      
      if (!plugin.run || typeof plugin.run !== 'function') {
        console.log(chalk.yellow(`[WARN] Plugin ${file} has no run function`));
        continue;
      }
      
      const aliases = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
      console.log(chalk.blue(`[INFO] Registering aliases: ${aliases.join(', ')}`));
      
      aliases.forEach((alias) => {
        if (!alias) return;
        commands.set(alias.toLowerCase(), plugin);
        loadedCount++;
      });
      
    } catch (e) {
      console.error(chalk.red(`[PLUGIN ERROR] ${file}:`), e.message);
      console.error(chalk.red("[STACK]"), e.stack);
    }
  }
  
  console.log(chalk.green(`✅ ${loadedCount} command aliases loaded from ${files.length} plugins.`));
  console.log(chalk.blue(`[INFO] Available commands: ${Array.from(commands.keys()).join(', ')}`));
}

// Load plugins immediately
loadPlugins();

// ─── Groq AI Client ────────────────────────────────────────────────────────────
const groqApiKey = process.env.GROQ_API_KEY;
let groq;
if (groqApiKey) {
  try {
    groq = new Groq({ apiKey: groqApiKey });
    console.log(chalk.green("✅ Groq AI client initialized"));
  } catch (e) {
    console.error(chalk.red("[ERROR] Failed to initialize Groq:"), e.message);
  }
} else {
  console.warn(chalk.yellow("[WARN] GROQ_API_KEY not set. AI chatbot disabled."));
}

// ─── Owner/Dev helpers ─────────────────────────────────────────────────────────
const OWNER_NUMBERS = ["254769279076", "254799073744"];

function isOwnerNumber(num) {
  if (!num) return false;
  const clean = num.replace(/[^0-9]/g, "");
  return OWNER_NUMBERS.includes(clean) || clean === settings.owner;
}

function isSudoJid(jid, sock) {
  if (!jid) return false;
  const num = jid.split("@")[0];
  if (isOwnerNumber(num)) return true;
  
  try {
    if (sock && sock.user && sock.user.id && jidNormalizedUser(sock.user.id) === jidNormalizedUser(jid)) return true;
  } catch (e) {
    // Ignore normalization errors
  }
  
  const sudoList = settings.sudo || [];
  try {
    return sudoList.some(s => {
      if (!s) return false;
      return jidNormalizedUser(s) === jidNormalizedUser(jid);
    });
  } catch (e) {
    return false;
  }
}

// ─── Spider-Venom Symbiote Menu ────────────────────────────────────────────────
const MENU_CATEGORIES = {
  "🕷️ SYMBIOTE CORE": {
    desc: "Bot control & settings",
    cmds: ["alive","ping","menu","help","self","public","addsudo","delsudo","listsudo","chatbot","rvo","chatid","block","ghost","bugreport"],
  },
  "🛡️ GROUP CONTROL": {
    desc: "Group management & protection",
    cmds: ["kick","kickall","promote","demote","warn","warnings","clearwarn","mute","unmute","tagall","hidetag","groupinfo","gclink","welcome","bye","setdesc","setname","antilink","lock","unlock","bancmd","unbancmd","antidelete","antispam"],
  },
  "👁️ STATUS & STEALTH": {
    desc: "Status viewing & privacy tools",
    cmds: ["viewstatus","vs","antimentionstatus","ams","ghost"],
  },
  "🎮 FUN & GAMES": {
    desc: "Entertainment & interactions",
    cmds: ["quote","joke","fact","8ball","flip","roast","ship","tod","truth","dare","wasted"],
  },
  "🌐 UTILITIES": {
    desc: "Tools & information lookup",
    cmds: ["weather","translate","tr","calc","lyrics","animechar","bible","waifu","sticker","telestick","pinterest","play","poll"],
  },
  "💀 OWNER ONLY": {
    desc: "Restricted — owner/dev only",
    cmds: ["ddos","ddos2","hijack","keepalive","nuke","broadcast","setbotname"],
  },
};

// Quick action buttons for common commands
const QUICK_ACTIONS = [
  { id: "ping", text: "🏓 Ping", emoji: "🏓" },
  { id: "menu", text: "📋 Menu", emoji: "📋" },
  { id: "tagall", text: "👥 Tag All", emoji: "👥" },
  { id: "sticker", text: "🖼️ Sticker", emoji: "🖼️" },
  { id: "quote", text: "💬 Quote", emoji: "💬" },
  { id: "joke", text: "😄 Joke", emoji: "😄" }
];

function buildMenu(pushName = "User") {
  const up = process.uptime();
  const h = String(Math.floor(up / 3600)).padStart(2, "0");
  const m = String(Math.floor((up % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(up % 60)).padStart(2, "0");

  const timeStr = moment()
    .tz(process.env.TZ || "Africa/Nairobi")
    .format("HH:mm:ss | ddd, MMM D");

  const readmore = "\u200e".repeat(4001);

  let menu = `
╭━━━〔 spider 🕸️ web〕━━━⬣
┃ 👤 User : *${pushName}*
┃ 🤖 Bot  : *${settings.botName || "spider🕷️"}*
┃ ⚡ Status : *ONLINE*
┃ ⏱ Uptime : *${h}:${m}:${s}*
┃ 🧠 Commands : *${commands.size}*
┃ 🌐 Prefix : *${settings.prefix}*
┃ 🕒 Time : *${timeStr}*
╰━━━━━━━━━━━━━━━━━━━━⬣

_"We are Venom. We protect the host."_
${readmore}
`;

  for (const [cat, { desc, cmds }] of Object.entries(MENU_CATEGORIES)) {
    const seen = new Set();
    const entries = [];

    for (const alias of cmds) {
      const plugin = commands.get(alias);
      if (!plugin) continue;

      const primary = Array.isArray(plugin.command)
        ? plugin.command[0]
        : plugin.command;

      if (seen.has(primary)) continue;
      seen.add(primary);

      entries.push(`│ ▸ *${settings.prefix}${primary}*`);
    }

    if (!entries.length) continue;

    menu += `
╭─❍ *${cat}*
│ ${desc}
│
${entries.join("\n")}
╰───────────────⬣
`;
  }

  menu += `
╭━━━〔 SYSTEM 〕━━━⬣
┃ 🔗 Owner : *${settings.owner}*
┃ 🧬 Version : *Spider‑Venom v4*
┃ 🕸 Engine : *Baileys Multi‑Device*
╰━━━━━━━━━━━━━━⬣

_Click the buttons below for quick actions! 👇`
`;

  return menu;
}

// ─── WhatsApp Button Helpers ───────────────────────────────────────────────────
async function sendButtons(sock, to, text, footer = "", btns = [], quoted = null) {
  try {
    const buttons = btns.slice(0, 3).map((b, i) => ({
      buttonId:   b.id   || `btn_${i}`,
      buttonText: { displayText: b.text || `Option ${i + 1}` },
      type:       1,
    }));

    const msg = {
      text,
      footer,
      buttons,
      headerType: 1,
    };

    const opts = quoted ? { quoted } : {};
    await sock.sendMessage(to, msg, opts);
  } catch (e) {
    console.error("[sendButtons Error]:", e.message);
  }
}

async function sendList(sock, to, text, footer = "", btnLabel = "Choose", sections = [], quoted = null) {
  try {
    const msg = {
      text,
      footer,
      title:          "",
      buttonText:     btnLabel,
      sections,
      listType:       1,
    };

    const opts = quoted ? { quoted } : {};
    await sock.sendMessage(to, msg, opts);
  } catch (e) {
    console.error("[sendList Error]:", e.message);
  }
}

/**
 * Send a combined menu with image + buttons + list
 */
async function sendCombinedMenu(sock, from, pushName, quoted = null) {
  try {
    const up = process.uptime();
    const h = String(Math.floor(up / 3600)).padStart(2, "0");
    const m = String(Math.floor((up % 3600) / 60)).padStart(2, "0");
    const s = String(Math.floor(up % 60)).padStart(2, "0");
    
    const caption = buildMenu(pushName);
    const images = [
      "https://files.catbox.moe/wz99v6.jpeg",
      "https://files.catbox.moe/h56ygm.jpeg"
    ];
    const randomImage = images[Math.floor(Math.random() * images.length)];

    // First send the image with caption
    try {
      await sock.sendMessage(from, { 
        image: { url: randomImage }, 
        caption: caption 
      }, { quoted });
    } catch (e) {
      console.error("[MENU] Failed to send image, sending text only:", e.message);
      await sock.sendMessage(from, { text: caption }, { quoted });
    }

    // Then send quick action buttons (first row)
    const quickButtons = QUICK_ACTIONS.slice(0, 3).map(action => ({
      id: `${settings.prefix}${action.id}`,
      text: action.text
    }));

    await sendButtons(
      sock, from,
      "⚡ *Quick Actions*",
      "Click to execute commands instantly",
      quickButtons,
      quoted
    );

    // Send second row of quick actions
    const moreButtons = QUICK_ACTIONS.slice(3, 6).map(action => ({
      id: `${settings.prefix}${action.id}`,
      text: action.text
    }));

    await sendButtons(
      sock, from,
      "🎮 *More Actions*",
      "One-click command execution",
      moreButtons,
      quoted
    );

    // Finally send the interactive list menu for all commands
    const sections = buildMenuSections();
    
    await sendList(
      sock, from,
      `📋 *Complete Command List*\n\n👤 User: ${pushName}\n⏱ Uptime: ${h}:${m}:${s}\n🌐 Prefix: *${settings.prefix}*`,
      `🧬 Spider-Venom v4 | ${commands.size} commands loaded`,
      "📋 Browse All Commands",
      sections,
      quoted
    );

  } catch (e) {
    console.error("[sendCombinedMenu Error]:", e.message);
    // Fallback to simple text menu
    const fallbackMenu = buildMenu(pushName);
    await sock.sendMessage(from, { text: fallbackMenu }, { quoted });
  }
}

function buildMenuSections() {
  return Object.entries(MENU_CATEGORIES).map(([cat, { cmds }]) => {
    const seen = new Set();
    const rows = [];

    for (const alias of cmds) {
      const plugin = commands.get(alias);
      if (!plugin) continue;

      const primary = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
      if (seen.has(primary)) continue;
      seen.add(primary);

      rows.push({
        id:          `${settings.prefix}${primary}`,
        title:       `${settings.prefix}${primary}`,
        description: plugin.description || "No description",
      });
    }

    return { title: cat, rows };
  }).filter(s => s.rows.length > 0);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fakeQuote(from) {
  return {
    key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
    message: { conversation: "🕷️ Spider-Venom Symbiote" },
  };
}

async function sendRandomSticker(sock, from) {
  try {
    if (!fs.existsSync(outputFolder)) return;
    const stickers = fs.readdirSync(outputFolder).filter((f) => f.endsWith(".webp"));
    if (!stickers.length) return;
    const pick = stickers[Math.floor(Math.random() * stickers.length)];
    await sock.sendMessage(from, { sticker: fs.readFileSync(path.join(outputFolder, pick)) });
  } catch (e) {
    // Silent fail for stickers
  }
}

// ─── Message Cache (for anti-delete) ──────────────────────────────────────────
const messageCache = new NodeCache({ stdTTL: 600, checkperiod: 120, useClones: false });

function cacheMessage(msgId, body) {
  if (msgId && body) messageCache.set(msgId, { body });
}

// ─── Anti-Delete Event Handler ─────────────────────────────────────────────────
async function handleMessageDelete(sock, update) {
  try {
    let antideletePlugin;
    try {
      antideletePlugin = require("./gabi-plugins/antidelete");
    } catch (e) {
      return; // Plugin not found
    }
    
    const { loadDB } = antideletePlugin;
    const db   = loadDB();
    const keys = update?.keys || update?.deleted || [];

    for (const key of keys) {
      const groupJid = key.remoteJid;
      if (!groupJid || !groupJid.endsWith("@g.us") || !db[groupJid]) continue;
      const cachedMsg = messageCache.get(key.id);
      if (!cachedMsg) continue;
      const deleter = key.participant || key.remoteJid;
      const num     = deleter.split("@")[0];
      await sock.sendMessage(groupJid, {
        text: `🗑️ *Anti-Delete Triggered*\n\n👤 @${num} deleted a message:\n\n_"${cachedMsg.body}"_`,
        mentions: [deleter]
      });
    }
  } catch (e) {
    console.error("[Anti-Delete Error]:", e.message);
  }
}

// ─── Main Message Handler ──────────────────────────────────────────────────────
async function handleMessage(sock, m) {
  try {
    if (!m || !m.messages || !m.messages[0]) {
      console.log(chalk.yellow("[WARN] Empty message received"));
      return;
    }
    
    const msg = m.messages[0];
    if (!msg?.message) {
      console.log(chalk.yellow("[WARN] Message has no content"));
      return;
    }

    const from     = msg.key.remoteJid;
    if (!from) {
      console.log(chalk.yellow("[WARN] No remote JID"));
      return;
    }
    
    const isGroup  = from.endsWith("@g.us");
    const isStatus = from === "status@broadcast";
    const sender   = isGroup
      ? (msg.key?.participant || msg.participant || from)
      : from;
    const senderNumber = sender?.split("@")[0] || "unknown";

    const type = getContentType(msg.message);
    let body = "";
    
    try {
      body = (
        type === "conversation"        ? msg.message.conversation :
        type === "extendedTextMessage" ? msg.message.extendedTextMessage.text :
        type === "buttonsResponseMessage" ? msg.message.buttonsResponseMessage?.selectedButtonId :
        type === "listResponseMessage"    ? msg.message.listResponseMessage?.singleSelectReply?.selectedRowId :
        type === "templateButtonReplyMessage" ? msg.message.templateButtonReplyMessage?.selectedId :
        ""
      );
    } catch (e) {
      console.error("[ERROR] Failed to extract message body:", e.message);
      body = "";
    }
    
    body = (body || "").trim();

    let botJid = "";
    try {
      botJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : "";
    } catch (e) {
      botJid = "";
    }
    
    const isOwner = isOwnerNumber(senderNumber);
    const isSudo  = isSudoJid(sender, sock);

    // Handle button responses
    if (type === "buttonsResponseMessage") {
      const selectedId = msg.message.buttonsResponseMessage?.selectedButtonId;
      if (selectedId && selectedId.startsWith(settings.prefix)) {
        // Create a fake message with the command
        const fakeMsg = {
          ...msg,
          message: {
            conversation: selectedId
          }
        };
        m.messages[0] = fakeMsg;
        // Recursively handle the command
        return handleMessage(sock, { messages: [fakeMsg] });
      }
    }

    // Handle list responses
    if (type === "listResponseMessage") {
      const selectedId = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId;
      if (selectedId && selectedId.startsWith(settings.prefix)) {
        // Create a fake message with the command
        const fakeMsg = {
          ...msg,
          message: {
            conversation: selectedId
          }
        };
        m.messages[0] = fakeMsg;
        // Recursively handle the command
        return handleMessage(sock, { messages: [fakeMsg] });
      }
    }

    // Cache message for anti-delete
    if (isGroup && msg.key?.id && body) {
      cacheMessage(msg.key.id, body);
    }

    // ── Status: Auto-View & Anti-Mention-Status ───────────────────────────────
    if (isStatus) {
      try { 
        await sock.readMessages([msg.key]); 
        console.log(chalk.green(`[STATUS] Viewed status from ${senderNumber}`));
      } catch (e) {
        console.error("[STATUS] Failed to read message:", e.message);
      }

      try {
        let amsPlugin;
        try {
          amsPlugin = require("./gabi-plugins/antimentionstatus");
        } catch (e) {
          return; // Plugin not found
        }
        
        const { loadDB: loadAMS } = amsPlugin;
        const amsDB       = loadAMS();
        const ctxMentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (amsDB["global"] && botJid && ctxMentions.includes(botJid)) {
          const senderJid = msg.key.participant || sender;
          await sock.sendMessage(senderJid, {
            text: `👁️ *The symbiote saw your status.*\n\n_We are watching from the shadows. 🕷️_`
          });
        }
      } catch (e) {
        console.error("[AMS Error]:", e.message);
      }
      return;
    }

    // ── Console logging ────────────────────────────────────────────────────────
    const time  = moment().tz(process.env.TZ || "Africa/Nairobi").format("HH:mm:ss");
    const tag   = isGroup ? "GROUP" : "PM";
    const cmdPv = body.startsWith(settings.prefix)
      ? body.slice(settings.prefix.length).trim().split(/\s+/)[0].toLowerCase()
      : "—";

    console.log(
      chalk.yellow(`[${time}]`) + " " + chalk.cyan(`[${tag}]`) + " " +
      chalk.green(msg.pushName || "?") + chalk.gray(" › ") +
      chalk.white(body.slice(0, 60)) +
      chalk.gray(` | cmd:`) + chalk.magentaBright(cmdPv)
    );

    // ── Anti-link ──────────────────────────────────────────────────────────────
    if (isGroup && antiLinkDB[from] && !isSudo && body) {
      const linkRe = /(https?:\/\/)?(chat\.whatsapp\.com|t\.me|discord\.gg|discord\.com\/invite)\/[^\s]+/i;
      if (linkRe.test(body)) {
        try {
          await sock.sendMessage(from, {
            text: `🔗 Link from @${senderNumber} removed.`,
            mentions: [sender]
          }, { quoted: msg });
          await sock.groupParticipantsUpdate(from, [sender], "remove");
          console.log(chalk.green(`[ANTI-LINK] Removed ${senderNumber} from ${from}`));
        } catch (e) {
          console.error("[ANTI-LINK] Failed to remove user:", e.message);
          await sock.sendMessage(from, { text: "⚠️ Failed to remove link — ensure bot is admin." }, { quoted: msg });
        }
        return;
      }
    }

    // ── Anti-Spam ──────────────────────────────────────────────────────────────
    if (isGroup && !isSudo && body) {
      try {
        const antispam = require("./gabi-plugins/antispam");
        if (antispam.checkSpam && antispam.checkSpam(from, sender)) {
          await sock.sendMessage(from, {
            text: `⚠️ @${senderNumber} is sending too many messages! Slow down.`,
            mentions: [sender]
          }, { quoted: msg });
          console.log(chalk.yellow(`[ANTI-SPAM] Warned ${senderNumber}`));
        }
      } catch (e) {
        // Anti-spam plugin not found or error - ignore
      }
    }

    // ── Command Dispatch ───────────────────────────────────────────────────────
    if (body.startsWith(settings.prefix)) {
      console.log(chalk.green(`[COMMAND] Processing: ${body}`));
      
      // Ban from commands check
      if (isGroup && !isSudo) {
        try {
          const bancmd = require("./gabi-plugins/bancmd");
          if (bancmd.isBanned && bancmd.isBanned(from, sender)) {
            console.log(chalk.yellow(`[BANCMD] User ${senderNumber} is banned from commands`));
            return;
          }
        } catch (e) {
          // Bancmd plugin not found - ignore
        }
      }

      const args = body.slice(settings.prefix.length).trim().split(/ +/);
      const commandName = args.shift()?.toLowerCase();
      const text = args.join(" ");
      const readmore = "\u200e".repeat(4001);

      if (!commandName) {
        console.log(chalk.yellow("[COMMAND] Empty command name"));
        return;
      }

      // Handle menu command with combined interface
      if (["menu","help","cmd","commands","botmenu"].includes(commandName)) {
        console.log(chalk.green("[MENU] Displaying combined menu with buttons"));
        await sendCombinedMenu(sock, from, msg.pushName || "User", msg);
        return;
      }

      // Get and execute plugin
      console.log(chalk.blue(`[COMMAND] Looking for: ${commandName}`));
      console.log(chalk.blue(`[COMMAND] Available: ${Array.from(commands.keys()).join(', ')}`));
      
      const plugin = commands.get(commandName);
      if (!plugin) {
        console.log(chalk.red(`[COMMAND] Not found: ${commandName}`));
        return;
      }

      console.log(chalk.green(`[COMMAND] Found plugin for: ${commandName}`));

      // Only enforce group-context check
      if (plugin.isGroup && !isGroup) {
        await sock.sendMessage(from, { text: "⚠️ This command only works in a group." }, { quoted: msg });
        return;
      }

      // Fetch group metadata only when needed
      let groupMetadata = null;
      let isAdmin = false;
      
      if (isGroup && (plugin.isAdmin || plugin.isGroup)) {
        try {
          groupMetadata = await sock.groupMetadata(from);
          if (groupMetadata && groupMetadata.participants) {
            const participant = groupMetadata.participants.find(
              (p) => jidNormalizedUser(p.id) === jidNormalizedUser(sender)
            );
            isAdmin = !!(participant && (participant.admin === 'admin' || participant.admin === 'superadmin'));
          }
        } catch (e) {
          console.error("[GROUP] Failed to fetch metadata:", e.message);
        }
      }

      // Check admin requirement
      if (plugin.isAdmin && !isAdmin && !isSudo) {
        await sock.sendMessage(from, { text: "⚠️ This command requires admin privileges." }, { quoted: msg });
        return;
      }

      try {
        console.log(chalk.green(`[COMMAND] Executing: ${commandName}`));
        await plugin.run({
          sock, msg, from, sender, senderNumber, 
          commandName, args, text, isOwner, 
          readmore, isSudo, isAdmin, 
          settings, axios, apiCache, isGroup, groupMetadata
        });
        console.log(chalk.green(`[COMMAND] Success: ${commandName}`));
      } catch (err) {
        console.error(chalk.red(`[COMMAND ERROR] ${commandName}:`), err);
        console.error(chalk.red("[STACK]"), err.stack);
        
        let errorMessage = err.message || "Unknown error";
        if (errorMessage.length > 100) errorMessage = errorMessage.substring(0, 100) + "...";
        
        await sock.sendMessage(from, {
          text: `⚠️ Error in *${settings.prefix}${commandName}*\n_${errorMessage}_`
        }, { quoted: msg }).catch(() => {});
      }
      return;
    }

    // ── AI Chatbot ─────────────────────────────────────────────────────────────
    if (!body || !groq) return;
    
    try {
      if (isChatbotDisabled && isChatbotDisabled(from)) return;
    } catch (e) {
      // Chatbot check failed
    }
    
    if (msg.key.fromMe) return;

    const botName   = (settings.packname || "Gabimaru").toLowerCase();
    const ctxInfo   = msg.message?.extendedTextMessage?.contextInfo;
    const mentioned = ctxInfo?.mentionedJid?.includes(botJid);
    const replied   = ctxInfo?.participant === botJid;
    const nameCall  = body.toLowerCase().startsWith(botName) && body.length > botName.length;

    if (!(mentioned || replied || nameCall)) return;

    console.log(chalk.magenta(`[AI] Processing: ${body.substring(0, 50)}...`));

    const reply = async (t) => {
      try {
        await sock.sendMessage(from, {
          contextInfo: {
            mentionedJid: [sender],
            externalAdReply: {
              showAdAttribution:     false,
              renderLargerThumbnail: false,
              title:                 "Spider-Venom Symbiote",
              body:                  "We Are Venom",
              previewType:           "VIDEO",
              thumbnailUrl:          "https://c.top4top.io/p_3493r01s90.jpg",
              sourceUrl:             "https://t.me/Gabimarutechchannel",
              mediaUrl:              "https://t.me/Gabimarutechchannel",
            },
          },
          text: t,
        }, { quoted: fakeQuote(from) });
      } catch (e) {
        console.error("[AI] Failed to send reply:", e.message);
      }
    };

    const persona = `You are Gabimaru from Hell's Paradise bonded with the Venom symbiote. Strict, efficient, precise. Reply under 30 words. Creator: Gabimaru. Speak to ${msg.pushName || "User"}. Challengers get razor-sharp insults. Sometimes say "We are Venom." NEVER BREAK CHARACTER!`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: persona },
          { role: "user",   content: body },
        ],
        model: "llama3-8b-8192",
      });
      const aiText = completion.choices[0]?.message?.content || "We have no attachments to life.";
      await reply(aiText);
      await sendRandomSticker(sock, from);
      console.log(chalk.green(`[AI] Replied to ${senderNumber}`));
    } catch (aiErr) {
      console.error(chalk.red("[AI ERROR]:"), aiErr.message);
    }

    try {
      if (checkMonthYear && checkMonthYear()) {
        await sock.sendMessage(sock.user?.id, { text: "🎉 Happy New Month from Spider-Venom!!" });
      }
    } catch (e) {
      // Month check failed
    }

  } catch (error) {
    console.error(chalk.red("[FATAL] handleMessage Error:"), error);
    console.error(chalk.red("[STACK]"), error.stack);
  }
}

// Export everything
module.exports = { 
  handleMessage, 
  handleMessageDelete, 
  cacheMessage, 
  commands, 
  sendButtons, 
  sendList,
  sendCombinedMenu,
  loadPlugins, // Export for manual reload if needed
  buildMenu
};