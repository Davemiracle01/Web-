/**
 * autoview.js - Auto View Status/Story with Mini Menu
 * Command: .autoview - Shows interactive mini menu
 */

const fs = require('fs');
const path = require('path');

// Database file for storing auto-view settings
const DB_PATH = path.join(__dirname, '../database/autoview.json');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// Load settings from database
function loadDB() {
    try {
        if (fs.existsSync(DB_PATH)) {
            return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        }
    } catch (e) {
        console.error('[AUTOVIEW] Failed to load database:', e.message);
    }
    return {};
}

// Save settings to database
function saveDB(db) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    } catch (e) {
        console.error('[AUTOVIEW] Failed to save database:', e.message);
    }
}

// Initialize database
let autoViewDB = loadDB();

module.exports = {
    command: ['autoview', 'autoviewstatus', 'av'],
    description: 'Auto-view status with interactive mini menu',
    category: 'utilities',
    isGroup: false,
    isAdmin: false,
    
    async run({ sock, msg, from, sender, args, text, isOwner, isSudo, settings }) {
        const senderNumber = sender.split('@')[0];
        const prefix = settings.prefix || '.';
        
        // Initialize user settings if not exists
        if (!autoViewDB[senderNumber]) {
            autoViewDB[senderNumber] = {
                enabled: false,
                autoLike: false,
                downloadMedia: false,
                saveToChat: false,
                blacklist: [],
                whitelist: [],
                likeEmoji: '❤️',
                viewDelay: 0,
                muteNotifications: false
            };
            saveDB(autoViewDB);
        }
        
        const userSettings = autoViewDB[senderNumber];
        
        // Handle specific commands if arguments provided
        if (args.length > 0) {
            const cmd = args[0].toLowerCase();
            
            // Toggle main auto-view
            if (cmd === 'on' || cmd === 'enable') {
                userSettings.enabled = true;
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: `✅ *Auto-View ENABLED*\n\nAll status updates will now be viewed automatically.` 
                }, { quoted: msg });
            }
            
            if (cmd === 'off' || cmd === 'disable') {
                userSettings.enabled = false;
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: `❌ *Auto-View DISABLED*\n\nStatus updates will not be viewed automatically.` 
                }, { quoted: msg });
            }
            
            // Toggle auto-like
            if (cmd === 'like') {
                userSettings.autoLike = !userSettings.autoLike;
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: userSettings.autoLike ? 
                        `👍 *Auto-Like ENABLED*\n\nStatuses will be liked with ${userSettings.likeEmoji}` :
                        `👎 *Auto-Like DISABLED*`
                }, { quoted: msg });
            }
            
            // Change like emoji
            if (cmd === 'emoji' && args[1]) {
                userSettings.likeEmoji = args[1];
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: `😊 *Like Emoji Changed*\n\nNow using: ${args[1]}` 
                }, { quoted: msg });
            }
            
            // Toggle download
            if (cmd === 'download' || cmd === 'dl') {
                userSettings.downloadMedia = !userSettings.downloadMedia;
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: userSettings.downloadMedia ? 
                        `📥 *Auto-Download ENABLED*\n\nStatus media will be saved` :
                        `📤 *Auto-Download DISABLED*`
                }, { quoted: msg });
            }
            
            // Toggle save to chat
            if (cmd === 'save') {
                userSettings.saveToChat = !userSettings.saveToChat;
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: userSettings.saveToChat ? 
                        `💾 *Save to Chat ENABLED*\n\nDownloaded media will be sent to this chat` :
                        `🗑️ *Save to Chat DISABLED*\n\nMedia will not be sent to chat`
                }, { quoted: msg });
            }
            
            // Set view delay
            if (cmd === 'delay' && args[1]) {
                const delay = parseInt(args[1]);
                if (!isNaN(delay) && delay >= 0 && delay <= 10) {
                    userSettings.viewDelay = delay;
                    saveDB(autoViewDB);
                    return await sock.sendMessage(from, { 
                        text: `⏱️ *View Delay Set*\n\nWaiting ${delay} second(s) before viewing each status` 
                    }, { quoted: msg });
                }
            }
            
            // Toggle mute notifications
            if (cmd === 'mute') {
                userSettings.muteNotifications = !userSettings.muteNotifications;
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: userSettings.muteNotifications ? 
                        `🔇 *Notifications MUTED*\n\nNo status view notifications` :
                        `🔔 *Notifications UNMUTED*\n\nYou'll see when statuses are viewed`
                }, { quoted: msg });
            }
            
            // Blacklist management
            if (cmd === 'blacklist') {
                const action = args[1];
                const number = args[2]?.replace(/[^0-9]/g, '');
                
                if (action === 'add' && number) {
                    if (!userSettings.blacklist.includes(number)) {
                        userSettings.blacklist.push(number);
                        saveDB(autoViewDB);
                        return await sock.sendMessage(from, { 
                            text: `⛔ *Added to Blacklist*\n\n${number} will NOT have their status viewed.` 
                        }, { quoted: msg });
                    }
                }
                
                if (action === 'remove' && number) {
                    const index = userSettings.blacklist.indexOf(number);
                    if (index > -1) {
                        userSettings.blacklist.splice(index, 1);
                        saveDB(autoViewDB);
                        return await sock.sendMessage(from, { 
                            text: `✅ *Removed from Blacklist*\n\n${number} will now have their status viewed.` 
                        }, { quoted: msg });
                    }
                }
                
                // Show blacklist
                const list = userSettings.blacklist.length ? 
                    userSettings.blacklist.map((n, i) => `  ${i+1}. ${n}`).join('\n') : 
                    '  No numbers in blacklist';
                
                return await sock.sendMessage(from, { 
                    text: `⛔ *BLACKLIST*\n\n${list}\n\n_Use:_\n${prefix}autoview blacklist add <number>\n${prefix}autoview blacklist remove <number>` 
                }, { quoted: msg });
            }
            
            // Whitelist management
            if (cmd === 'whitelist') {
                const action = args[1];
                const number = args[2]?.replace(/[^0-9]/g, '');
                
                if (action === 'add' && number) {
                    if (!userSettings.whitelist.includes(number)) {
                        userSettings.whitelist.push(number);
                        saveDB(autoViewDB);
                        return await sock.sendMessage(from, { 
                            text: `✅ *Added to Whitelist*\n\nONLY ${number} will have their status viewed.` 
                        }, { quoted: msg });
                    }
                }
                
                if (action === 'remove' && number) {
                    const index = userSettings.whitelist.indexOf(number);
                    if (index > -1) {
                        userSettings.whitelist.splice(index, 1);
                        saveDB(autoViewDB);
                        return await sock.sendMessage(from, { 
                            text: `⛔ *Removed from Whitelist*\n\nAll contacts will now have their status viewed.` 
                        }, { quoted: msg });
                    }
                }
                
                // Show whitelist
                const list = userSettings.whitelist.length ? 
                    userSettings.whitelist.map((n, i) => `  ${i+1}. ${n}`).join('\n') : 
                    '  No numbers in whitelist (viewing all)';
                
                return await sock.sendMessage(from, { 
                    text: `✅ *WHITELIST*\n\n${list}\n\n_Use:_\n${prefix}autoview whitelist add <number>\n${prefix}autoview whitelist remove <number>` 
                }, { quoted: msg });
            }
            
            // Reset settings
            if (cmd === 'reset') {
                autoViewDB[senderNumber] = {
                    enabled: false,
                    autoLike: false,
                    downloadMedia: false,
                    saveToChat: false,
                    blacklist: [],
                    whitelist: [],
                    likeEmoji: '❤️',
                    viewDelay: 0,
                    muteNotifications: false
                };
                saveDB(autoViewDB);
                return await sock.sendMessage(from, { 
                    text: `🔄 *Settings RESET*\n\nAll auto-view settings restored to default.` 
                }, { quoted: msg });
            }
        }
        
        // ========== MINI MENU DISPLAY ==========
        // Show the interactive mini menu with all settings
        
        // Status emoji indicators
        const enabledEmoji = userSettings.enabled ? '✅' : '❌';
        const likeEmoji = userSettings.autoLike ? '✅' : '❌';
        const downloadEmoji = userSettings.downloadMedia ? '✅' : '❌';
        const saveEmoji = userSettings.saveToChat ? '✅' : '❌';
        const muteEmoji = userSettings.muteNotifications ? '🔇' : '🔔';
        
        // Counts
        const blacklistCount = userSettings.blacklist.length;
        const whitelistCount = userSettings.whitelist.length;
        
        const menuText = `╭━━━━━━━━━━━━━━━━━━╮
┃   👁️ AUTO VIEW   ┃
╰━━━━━━━━━━━━━━━━━━╯

┌─〔 CURRENT STATUS 〕
│ ${enabledEmoji} Auto-View  : ${userSettings.enabled ? 'ON' : 'OFF'}
│ ${likeEmoji} Auto-Like   : ${userSettings.autoLike ? 'ON' : 'OFF'} ${userSettings.autoLike ? '('+userSettings.likeEmoji+')' : ''}
│ ${downloadEmoji} Auto-Download : ${userSettings.downloadMedia ? 'ON' : 'OFF'}
│ ${saveEmoji} Save to Chat : ${userSettings.saveToChat ? 'ON' : 'OFF'}
│ ${muteEmoji} Notifications : ${userSettings.muteNotifications ? 'MUTED' : 'ACTIVE'}
│ ⏱️ View Delay   : ${userSettings.viewDelay}s
├────────────────────
│ ⛔ Blacklist    : ${blacklistCount} number(s)
│ ✅ Whitelist    : ${whitelistCount} number(s)
└────────────────────

┌─〔 ONE-CLICK TOGGLES 〕
│ ${prefix}autoview on     - Enable auto-view
│ ${prefix}autoview off    - Disable auto-view
│ ${prefix}autoview like   - Toggle auto-like
│ ${prefix}autoview download - Toggle download
│ ${prefix}autoview save    - Toggle save to chat
│ ${prefix}autoview mute    - Toggle notifications
├────────────────────
│ ${prefix}autoview emoji ❤️  - Change like emoji
│ ${prefix}autoview delay 2  - Set view delay (0-10s)
├────────────────────
│ ${prefix}autoview blacklist add 2547xxxx
│ ${prefix}autoview blacklist remove 2547xxxx
│ ${prefix}autoview whitelist add 2547xxxx
│ ${prefix}autoview whitelist remove 2547xxxx
├────────────────────
│ ${prefix}autoview reset  - Reset all settings
└────────────────────

_Statuses will be viewed automatically when enabled_ 👁️`;

        // Send the mini menu
        await sock.sendMessage(from, { text: menuText }, { quoted: msg });
        
        // If they have whitelist/blacklist items, show them in a separate message if needed
        if (blacklistCount > 0 || whitelistCount > 0) {
            let listText = '';
            
            if (blacklistCount > 0) {
                listText += '⛔ *Blacklist:*\n' + 
                    userSettings.blacklist.map((n, i) => `  ${i+1}. ${n}`).join('\n') + '\n\n';
            }
            
            if (whitelistCount > 0) {
                listText += '✅ *Whitelist:*\n' + 
                    userSettings.whitelist.map((n, i) => `  ${i+1}. ${n}`).join('\n');
            }
            
            if (listText) {
                await sock.sendMessage(from, { text: listText }, { quoted: msg });
            }
        }
    }
};