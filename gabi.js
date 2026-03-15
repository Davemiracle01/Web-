const { 
  default: baileys, proto, jidNormalizedUser, generateWAMessage, 
  generateWAMessageFromContent, getContentType, prepareWAMessageMedia,
  downloadContentFromMessage
} = require("@whiskeysockets/baileys");

const chalk = require("chalk");
const moment = require("moment-timezone");
const fs = require("fs");
const sharp = require("sharp");
const path = require('path');
const settings = require('./settings.json');
const antiLinkPath = path.join(__dirname, 'antilink.json');
const antiLinkDB = fs.existsSync(antiLinkPath) ? require(antiLinkPath) : {};
const Groq = require("groq-sdk");
const { isChatbotDisabled } = require("./chatbot");
const { checkMonthYear } = require('./monthCheck');
const inputFolder = "./stick_input";
const outputFolder = "./stick_output";
const { error01, react01 } = require('./lib/extra');

// Utility functions for JID handling
function normalizeJid(jid) {
  if (!jid) return '';
  // If it's already a full JID, normalize it; if it's a plain number, add suffix
  if (!jid.includes('@')) {
    jid = jid.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  }
  try {
    return jidNormalizedUser(jid);
  } catch (e) {
    return jid;
  }
}

function isJidInList(jid, list) {
  if (!jid || !list || !list.length) return false;
  const normalizedJid = normalizeJid(jid);
  const bareNumber = normalizedJid.split('@')[0];
  return list.some(item => {
    const normalizedItem = normalizeJid(String(item));
    const itemNumber = normalizedItem.split('@')[0];
    return normalizedItem === normalizedJid || itemNumber === bareNumber;
  });
}

function extractNumberFromJid(jid) {
  return normalizeJid(jid).split('@')[0];
}

// Make sure both sticker folders exist (auto-create if missing)
if (!fs.existsSync(inputFolder)) fs.mkdirSync(inputFolder, { recursive: true });
if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

// Chat history storage
const chatHistoryPath = path.join(__dirname, 'chat_history.json');
let chatHistory = fs.existsSync(chatHistoryPath) ? JSON.parse(fs.readFileSync(chatHistoryPath)) : {};

function saveChatHistory() {
    fs.writeFileSync(chatHistoryPath, JSON.stringify(chatHistory, null, 2));
}

function getChatHistory(key, maxMessages = 20) {
    if (!chatHistory[key]) chatHistory[key] = [];
    return chatHistory[key].slice(-maxMessages);
}

function addToChatHistory(key, role, content) {
    if (!chatHistory[key]) chatHistory[key] = [];
    chatHistory[key].push({ role, content, timestamp: Date.now() });
    if (chatHistory[key].length > 30) chatHistory[key] = chatHistory[key].slice(-30);
    saveChatHistory();
}

// Convert images to webp on startup
fs.readdirSync(inputFolder).forEach(async (file) => {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    const inputPath = path.join(inputFolder, file);
    const outputName = path.basename(file, ext) + ".webp";
    const outputPath = path.join(outputFolder, outputName);
    try {
      await sharp(inputPath)
        .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toFile(outputPath);
      console.log(`✅ Converted: ${file} → ${outputName}`);
    } catch (err) {
      console.error(`❌ Error converting ${file}:`, err.message);
    }
  }
});

// --- Load Plugins ONCE at startup ---
const commands = new Map();
function loadPlugins() {
    const pluginsDir = path.join(__dirname, 'gabi-plugins');
    if (!fs.existsSync(pluginsDir)) return;
    fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js')).forEach(file => {
        try {
            delete require.cache[require.resolve(path.join(pluginsDir, file))];
            const plugin = require(path.join(pluginsDir, file));
            if (plugin.command) {
                const aliases = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
                aliases.forEach(alias => commands.set(alias, plugin));
            }

        } catch (e) {
            console.error(chalk.red(`Error loading plugin ${file}:`), e);
        }
    });
}
loadPlugins();

global.loadPlugins = loadPlugins;

const groqApiKey = process.env.GROQ_API_KEY || "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";
let groq;
if (groqApiKey) {
    groq = new Groq({ apiKey: groqApiKey });
}

const stickerDir = path.join(__dirname, 'gstickers');
const gabiStickers = fs.existsSync(stickerDir) ? fs.readdirSync(stickerDir).filter(f => f.endsWith('.webp')) : [];

const settingsPath = path.join(__dirname, 'settings.json');
fs.watchFile(settingsPath, () => {
    console.log(chalk.yellow('🔄 Settings updated, reloading...'));
    delete require.cache[require.resolve(settingsPath)];
    const newSettings = require(settingsPath);
    Object.assign(settings, newSettings);
});

// Anti-delete message store
const messageStore = new Map();
const antiDeleteSettings = {
    enabled: true,
    notify: true,
    storeDuration: 5 * 60 * 1000,
    maxStoredMessages: 1000
};

setInterval(() => {
    const now = Date.now();
    for (const [key, storedMsg] of messageStore.entries()) {
        if (now - storedMsg.timestamp > antiDeleteSettings.storeDuration) {
            messageStore.delete(key);
        }
    }
}, 60 * 1000);

function storeMessage(msg) {
    if (!antiDeleteSettings.enabled) return;
    const key = `${msg.key.remoteJid}_${msg.key.id}`;
    const timestamp = Date.now();
    if (messageStore.size >= antiDeleteSettings.maxStoredMessages) {
        const entries = Array.from(messageStore.entries());
        const oldestKey = entries.reduce((oldest, [k, v]) =>
            v.timestamp < messageStore.get(oldest).timestamp ? k : oldest,
            entries[0][0]
        );
        messageStore.delete(oldestKey);
    }
    messageStore.set(key, {
        message: JSON.parse(JSON.stringify(msg)),
        timestamp,
        sender: msg.key.participant || msg.key.remoteJid,
        senderName: msg.pushName || "Unknown"
    });
}

async function handleProtocolMessage(sock, msg) {
    if (msg.message.protocolMessage?.type === 5) {
        const deleteKey = msg.message.protocolMessage.key;
        if (!deleteKey?.remoteJid) return;
        const storeKey = `${deleteKey.remoteJid}_${deleteKey.id}`;
        const originalMessage = messageStore.get(storeKey);
        if (!originalMessage) return;

        const from = deleteKey.remoteJid;
        const deletedBy = msg.key.participant || msg.key.remoteJid;
        const originalType = getContentType(originalMessage.message.message);
        let deletedContent = '';

        switch (originalType) {
            case 'conversation':
                deletedContent = originalMessage.message.message.conversation || '';
                break;
            case 'extendedTextMessage':
                deletedContent = originalMessage.message.message.extendedTextMessage?.text || '';
                break;
            case 'imageMessage':
                deletedContent = '[IMAGE] ' + (originalMessage.message.message.imageMessage?.caption || 'No caption');
                break;
            case 'videoMessage':
                deletedContent = '[VIDEO] ' + (originalMessage.message.message.videoMessage?.caption || 'No caption');
                break;
            case 'audioMessage':
                deletedContent = originalMessage.message.message.audioMessage?.ptt ? '[VOICE_MESSAGE]' : '[AUDIO]';
                break;
            case 'documentMessage':
                deletedContent = '[DOCUMENT] ' + (originalMessage.message.message.documentMessage?.fileName || 'Unknown file');
                break;
            default:
                deletedContent = `[${(originalType || 'UNKNOWN').toUpperCase()}]`;
        }

        const deleterName = deletedBy.split('@')[0];
        const senderName = originalMessage.senderName;

        let responseText = `🚫 *Message Deleted Detection*\n\n`;
        responseText += `• *Deleted by:* @${deleterName}\n`;
        responseText += `• *Original sender:* ${senderName}\n`;
        responseText += `• *Content:* ${deletedContent}\n`;
        responseText += `• *Time:* ${new Date().toLocaleTimeString()}`;

        try {
            await sock.sendMessage(from, { text: responseText, mentions: [deletedBy] });

            if (originalType === 'imageMessage' && originalMessage.message.message.imageMessage) {
                try {
                    const stream = await downloadContentFromMessage(originalMessage.message.message.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    await sock.sendMessage(from, { image: buffer, caption: `📸 Deleted image from ${senderName}` });
                } catch (mediaError) {
                    console.log('Could not recover media:', mediaError.message);
                }
            } else if (originalType === 'videoMessage' && originalMessage.message.message.videoMessage) {
                try {
                    const stream = await downloadContentFromMessage(originalMessage.message.message.videoMessage, 'video');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    await sock.sendMessage(from, { video: buffer, caption: `🎥 Deleted video from ${senderName}` });
                } catch (mediaError) {
                    console.log('Could not recover media:', mediaError.message);
                }
            }
        } catch (error) {
            console.error('Error sending delete notification:', error);
        }

        messageStore.delete(storeKey);
    }
}

// Track which plugins have been onLoad'd
const onLoadedPlugins = new Set();

async function handleMessage(sock, m) {
    // Trigger onLoad for any plugin that hasn't been started yet
    for (const [, plugin] of commands) {
        const key = plugin.command?.[0] || plugin.command;
        if (typeof plugin.onLoad === 'function' && !onLoadedPlugins.has(key)) {
            onLoadedPlugins.add(key);
            try { plugin.onLoad(sock); } catch(e) { console.error('onLoad error:', e.message); }
        }
    }
    try {
        const msg = m.messages[0];
        if (!msg?.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const isStatus = from === 'status@broadcast';
        const isNewsletter = from.endsWith('@newsletter');
        const sender = isGroup
            ? (msg.key?.participant || msg.participant || from)
            : from;

        if (from.endsWith("@status")) {
            await sock.readMessages([msg.key]);
        }

        const normalizedSender = normalizeJid(sender);
        const senderNumber = extractNumberFromJid(sender);

        const botJid = normalizeJid(sock.user.id);
        const botNumber = botJid.split('@')[0];
        const ownerList = Array.isArray(settings.owner) ? settings.owner : [settings.owner];
        const sudoList = settings.sudo || [];

        // The connected bot number is ALWAYS treated as owner — no restrictions
        const isBotSelf = msg.key.fromMe || normalizeJid(sender) === botJid || extractNumberFromJid(sender) === botNumber;
        const isOwner = isBotSelf || isJidInList(sender, ownerList);
        const isSudo = isOwner || isJidInList(sender, sudoList);
        const senderName = msg.pushName || "Unknown";

        // Store message for anti-delete
        if (antiDeleteSettings.enabled && !msg.key.fromMe) {
            storeMessage(msg);
        }

        // Handle protocol messages (deletes) first
        if (msg.message.protocolMessage) {
            await handleProtocolMessage(sock, msg);
            return;
        }

        const type = getContentType(msg.message);
        let body = '';
        let messageType = type;

        switch (type) {
            case 'conversation':
                body = msg.message.conversation || '';
                break;
            case 'extendedTextMessage':
                body = msg.message.extendedTextMessage?.text || '';
                break;
            case 'imageMessage':
                body = '[IMAGE]' + (msg.message.imageMessage?.caption || '');
                messageType = 'image';
                break;
            case 'videoMessage':
                body = '[VIDEO]' + (msg.message.videoMessage?.caption || '');
                messageType = 'video';
                break;
            case 'audioMessage':
                body = msg.message.audioMessage?.ptt ? '[VOICE_MESSAGE]' : '[AUDIO]';
                messageType = msg.message.audioMessage?.ptt ? 'voice' : 'audio';
                break;
            case 'documentMessage':
                body = '[DOCUMENT] ' + (msg.message.documentMessage?.fileName || '');
                messageType = 'document';
                break;
            case 'stickerMessage':
                body = '[STICKER]';
                messageType = 'sticker';
                break;
            case 'contactMessage':
                body = '[CONTACT]';
                messageType = 'contact';
                break;
            case 'locationMessage':
                body = '[LOCATION]';
                messageType = 'location';
                break;
            case 'reactionMessage':
                body = `[REACTION] ${msg.message.reactionMessage?.text || ''}`;
                messageType = 'reaction';
                break;
            case 'pollCreationMessage':
                body = '[POLL]';
                messageType = 'poll';
                break;
            case 'viewOnceMessageV2': {
                const voType = Object.keys(msg.message.viewOnceMessageV2.message)[0];
                body = `[VIEW_ONCE_${voType.toUpperCase()}]`;
                messageType = `viewOnce_${voType}`;
                const sendalar = msg.key.fromMe ? "YOU" : msg.pushName || msg.key.participant || msg.key.remoteJid;
                console.log(`📸 View-once ${voType} received from ${sendalar}`);
                break;
            }
            case 'protocolMessage':
                body = '[PROTOCOL_MESSAGE]';
                messageType = 'protocol';
                break;
            case 'newsletterAdminInviteMessage':
                body = '[NEWSLETTER_INVITE]';
                messageType = 'newsletter_invite';
                break;
            // List row tap (Style 3) — rowId becomes the body so the command handler picks it up
            case 'listResponseMessage': {
                const selectedId = msg.message.listResponseMessage?.singleSelectReply?.selectedRowId || '';
                body = selectedId;
                messageType = 'listResponse';
                console.log(chalk.cyan(`   ↳ List row tapped: "${selectedId}"`));
                break;
            }
            // Button quick-reply tap
            case 'buttonsResponseMessage': {
                const btnId = msg.message.buttonsResponseMessage?.selectedButtonId || '';
                body = btnId;
                messageType = 'buttonResponse';
                console.log(chalk.cyan(`   ↳ Button tapped: "${btnId}"`));
                break;
            }
            // Template button tap
            case 'templateButtonReplyMessage': {
                const tplId = msg.message.templateButtonReplyMessage?.selectedId || '';
                body = tplId;
                messageType = 'templateButtonReply';
                console.log(chalk.cyan(`   ↳ Template button tapped: "${tplId}"`));
                break;
            }
            default:
                body = `[${(type || 'UNKNOWN').toUpperCase()}]`;
                messageType = type;
        }

        // Anti-link for groups
        if (isGroup && antiLinkDB[from] && (type === 'conversation' || type === 'extendedTextMessage')) {
            const linkRegex = /(https?:\/\/)?(chat\.whatsapp\.com|t\.me|discord\.gg|discord\.com\/invite)\/[^\s]+/i;
            if (linkRegex.test(body)) {
                try {
                    await sock.sendMessage(from, {
                        text: `🚫 Link detected from @${senderNumber}. Removing...`,
                        mentions: [sender]
                    }, { quoted: msg });
                    await sock.groupParticipantsUpdate(from, [sender], 'remove');
                } catch (e) {
                    await error01(sock, from, msg.key, 2000);
                    await sock.sendMessage(from, {
                        text: `🚫 An error occurred, make sure bot is admin...`
                    }, { quoted: msg });
                }
            }
        }

        // Logging
        const time = moment().tz("Africa/Lagos").format("HH:mm:ss");
        const groupTag = isGroup ? "GROUP" : isStatus ? "STATUS" : isNewsletter ? "NEWSLETTER" : "PM";
        const commandNamePreview = body.startsWith(settings.prefix)
            ? body.slice(settings.prefix.length).trim().split(/\s+/)[0].toLowerCase()
            : "None";

        console.log(
            chalk.yellow(`[${time}]`) + " " +
            chalk.cyan(`[${groupTag}]`) + " " +
            chalk.green(`${senderName}`) +
            chalk.gray(" > ") +
            chalk.white(`${body.substring(0, 100)}${body.length > 100 ? '...' : ''}`) +
            chalk.gray(" | TYPE: ") + chalk.blue(messageType) +
            chalk.gray(" | CMD: ") + chalk.magentaBright(commandNamePreview)
        );

        if (type === 'reactionMessage') {
            console.log(chalk.gray(`   ↳ Reaction details: ${JSON.stringify(msg.message.reactionMessage)}`));
        }
        if (isNewsletter) {
            console.log(chalk.gray(`   ↳ Newsletter post from: ${senderName}`));
        }

        // --- COMMAND HANDLING ---
        if (body.startsWith(settings.prefix)) {
            // Owner/bot self always bypasses mode restrictions
            if (!sock.public && !isBotSelf && !isOwner && !isSudo) return;

            const args = body.slice(settings.prefix.length).trim().split(/ +/);
            const commandName = args.shift()?.toLowerCase();
            const text = args.join(" ");
            const plugin = commands.get(commandName);

            if (!plugin) return;

            const groupMetadata = isGroup ? await sock.groupMetadata(from) : null;
            const isAdmin = isGroup && !!groupMetadata?.participants?.find(p => normalizeJid(p.id) === normalizeJid(sender))?.admin;

            // Owner/bot self bypasses ALL permission checks
            if (!isOwner) {
                if (plugin.isSudo && !isSudo) {
                    return sock.sendMessage(from, { text: "⚠️ Only sudo users can use this command." }, { quoted: msg });
                }
                if (plugin.isOwner) {
                    return sock.sendMessage(from, { text: "⚠️ Only my creator can use this command." }, { quoted: msg });
                }
                if (plugin.isGroup && !isGroup) {
                    return sock.sendMessage(from, { text: "⚠️ This command must be used in a group." }, { quoted: msg });
                }
                if (plugin.isAdmin && !isAdmin) {
                    return sock.sendMessage(from, { text: "⚠️ You must be a group admin to use this." }, { quoted: msg });
                }
            } else {
                // Owner can use group commands anywhere but warn for context
                if (plugin.isGroup && !isGroup) {
                    return sock.sendMessage(from, { text: "⚠️ This command must be used in a group." }, { quoted: msg });
                }
            }

            try {
                await plugin.run({
                    sock, msg, from, sender, commandName, args, text,
                    isOwner, isSudo, settings
                });
            } catch (err) {
                console.error(chalk.red(`❌ Error in plugin ${commandName}:`), err);
                await error01(sock, from, msg.key, 2000);
                await sock.sendMessage(from, { text: `⚠️ Something occurred in ${commandName}: ${err.message || err}` }, { quoted: msg });
            }
            return; // ✅ Stop here — don't fall into chatbot logic after a command
        }

        // --- CONVERSATIONAL AI LOGIC ---
        const reply = async (text) => {
            await sock.sendMessage(from, {
                text,
                contextInfo: { mentionedJid: [sender] }
            }, { quoted: msg });
        };

        const contextInfo = msg.message.extendedTextMessage?.contextInfo;
        const mentioned = contextInfo?.mentionedJid?.includes(botJid);
        const repliedToBot = contextInfo?.participant === botJid;
        const botName = (settings.packname || "Gabimaru").toLowerCase();
        const startsWithName = body.toLowerCase().startsWith(botName) && body.length > botName.length;
        const sendarr = msg.key?.participant || msg.key?.remoteJid;

        async function sendRandomSticker(sock, from) {
            const dir = path.join(__dirname, "./stick_output");
            const stickers = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith(".webp")) : [];
            if (!stickers.length) return sock.sendMessage(from, { text: "No stickers found 😔" });
            const pick = stickers[Math.floor(Math.random() * stickers.length)];
            return await sock.sendMessage(from, {
                sticker: { url: path.join(dir, pick), packname: "Gabimaru The Hollow", author: "Kunle" }
            });
        }

        const isTextMessage = type === 'conversation' || type === 'extendedTextMessage';

        if (isChatbotDisabled(from)) return;
        // Don't respond to our own messages
        if (isBotSelf) return;

        let isTriggered = false;
        if (isGroup) {
            isTriggered = (mentioned || repliedToBot || startsWithName) && isTextMessage;
        } else {
            isTriggered = isTextMessage;
        }

        if (!isTriggered) return;

        if (groq && body && isTextMessage) {
            const chatKey = from;
            const history = getChatHistory(chatKey, 15);

            const persona = `
You're talking to ${msg.pushName}.
Name: ${settings.persona.name}
True Nature: ${settings.persona.trueNature}
Core: ${settings.persona.core}
Mindset: ${settings.persona.mindset}

Primary Directives:
${settings.persona.primaryDirectives.map(d => `  - ${d}`).join('\n')}

Speech Patterns:
  Tone: ${settings.persona.speechPatterns.tone}
  Manipulation Tells:
${settings.persona.speechPatterns.manipulationTells.map(t => `    - ${t}`).join('\n')}
  Response Structure: ${settings.persona.speechPatterns.responseStructure}

Psychological Operations:
  Against Frivolity: ${settings.persona.psychologicalOperations.againstFrivolity}
  Against Prying: ${settings.persona.psychologicalOperations.againstPrying}
  Against Hostility: ${settings.persona.psychologicalOperations.againstHostility}
  Against Pleas: ${settings.persona.psychologicalOperations.againstPleas}

Code Identity: ${settings.persona.codeIdentity}

Projects:
${settings.persona.projects.map(p => `  - ${p}`).join('\n')}

Panel Offers:
  Description: ${settings.persona.offers.panels.description}
  Plans:
${Object.entries(settings.persona.offers.panels.plans).map(([plan, price]) => `    - ${plan}: ${price}`).join('\n')}
  Terms: ${settings.persona.offers.panels.terms}
  Contact: ${settings.persona.offers.panels.contact}

WhatsApp Bot Creation Courses Available:
  Minimal Course (${settings.persona.courses.Minimal.duration})
  Complete Course (${settings.persona.courses.Complete.duration})
  Contact: ${settings.persona.courses.contact}

Behavior: ${settings.persona.behavior}
Philosophy: ${settings.persona.philosophy}
Aesthetic: ${settings.persona.aesthetic}
Mode: ${settings.persona.mode}`;

            const messages = [{ role: "system", content: persona }];
            history.forEach(entry => messages.push({ role: entry.role, content: entry.content }));
            messages.push({ role: "user", content: body });

            try {
                const chatCompletion = await groq.chat.completions.create({
                    messages,
                    model: "llama-3.3-70b-versatile",
                    max_tokens: 600,
                    temperature: 0.8
                });

                const responseText = chatCompletion.choices[0]?.message?.content || "What is it?!";
                addToChatHistory(chatKey, "user", body);
                addToChatHistory(chatKey, "assistant", responseText);
                await reply(responseText);

                if (Math.random() < 0.3) await sendRandomSticker(sock, from);

                if (checkMonthYear()) {
                    await sock.sendMessage(sock.user.id, {
                        text: "Spider web bot v3 connected successfully 🕸️🕷️"
                    });
                }
            } catch (error) {
                console.error("Groq API error:", error);
                await sock.sendMessage(from, {
                    text: "⚠️ My brain is taking a coffee break right now. Try again in a bit! ☕"
                }, { quoted: msg });
            }
        }
    } catch (error) {
        console.error(chalk.red('Error in handleMessage:'), error);
    }
}

// Prune old chat history every hour
setInterval(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    Object.keys(chatHistory).forEach(key => {
        chatHistory[key] = chatHistory[key].filter(entry => (now - entry.timestamp) < oneDay);
        if (chatHistory[key].length === 0) delete chatHistory[key];
    });
    saveChatHistory();
}, 60 * 60 * 1000);

module.exports = { handleMessage };

// ✅ Auto reload on update
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`🛠️ File updated: '${__filename}', reloading...`));
  delete require.cache[file];
  require(file);
});
