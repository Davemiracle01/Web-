/**
 * WhatsApp Buttons Test Plugin
 * Tests all available interactive message types in Baileys
 * 
 * Commands:
 *   .btntest 1  → Plain buttons (buttonMessage)
 *   .btntest 2  → Template buttons (text + URL + call)
 *   .btntest 3  → List message (sections + rows)
 *   .btntest 4  → Image with buttons
 *   .btntest 5  → External Ad Reply (fake forwarded ad card)
 *   .btntest 6  → Poll message
 *   .btntest 7  → All tests in sequence
 */

const { react01 } = require('../lib/extra');

// ─── Helpers ────────────────────────────────────────────────────────────────

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// Fake quoted "banner" used by some button styles
function fakeQuote(from) {
    return {
        key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: from },
        message: { conversation: "🧪 Gabimaru Button Test" }
    };
}

// ─── Test 1 — Plain Button Message ─────────────────────────────────────────
async function testPlainButtons(sock, from, msg) {
    try {
        const buttons = [
            { buttonId: "btn_1", buttonText: { displayText: "🔥 Option One" }, type: 1 },
            { buttonId: "btn_2", buttonText: { displayText: "⚡ Option Two" }, type: 1 },
            { buttonId: "btn_3", buttonText: { displayText: "💀 Option Three" }, type: 1 },
        ];

        await sock.sendMessage(from, {
            text: "🧪 *Test 1: Plain Buttons*\n\nChoose an option below:",
            footer: "Gabimaru Button Test",
            buttons,
            headerType: 1
        }, { quoted: msg });

        return "✅ Test 1 sent";
    } catch (e) {
        return `❌ Test 1 failed: ${e.message}`;
    }
}

// ─── Test 2 — Template Buttons (text + URL + call) ─────────────────────────
async function testTemplateButtons(sock, from, msg) {
    try {
        const templateButtons = [
            {
                index: 1,
                urlButton: {
                    displayText: "🌐 Visit GitHub",
                    url: "https://github.com/Gabimaru-Dev"
                }
            },
            {
                index: 2,
                callButton: {
                    displayText: "📞 Call Owner",
                    phoneNumber: "+2349012834275"
                }
            },
            {
                index: 3,
                quickReplyButton: {
                    displayText: "💬 Quick Reply",
                    id: "qr_test_id"
                }
            }
        ];

        await sock.sendMessage(from, {
            text: "🧪 *Test 2: Template Buttons*\n\nURL + Call + Quick Reply:",
            footer: "Gabimaru Button Test",
            templateButtons,
            headerType: 1
        }, { quoted: msg });

        return "✅ Test 2 sent";
    } catch (e) {
        return `❌ Test 2 failed: ${e.message}`;
    }
}

// ─── Test 3 — List Message ──────────────────────────────────────────────────
async function testListMessage(sock, from, msg) {
    try {
        const sections = [
            {
                title: "🛡️ Admin Commands",
                rows: [
                    { title: "Kick User", rowId: "cmd_kick", description: "Remove a member from group" },
                    { title: "Mute Group", rowId: "cmd_mute", description: "Silence non-admins" },
                    { title: "Promote User", rowId: "cmd_promote", description: "Give admin rights" },
                ]
            },
            {
                title: "🎭 Fun Commands",
                rows: [
                    { title: "Waifu", rowId: "cmd_waifu", description: "Get a random waifu image" },
                    { title: "Sticker", rowId: "cmd_sticker", description: "Convert image to sticker" },
                    { title: "TikTok DL", rowId: "cmd_tiktok", description: "Download TikTok video" },
                ]
            },
            {
                title: "🤖 Bot Settings",
                rows: [
                    { title: "Chatbot On/Off", rowId: "cmd_chatbot", description: "Toggle AI chatbot" },
                    { title: "Set Prefix", rowId: "cmd_prefix", description: "Change command prefix" },
                    { title: "Alive", rowId: "cmd_alive", description: "Check bot uptime" },
                ]
            }
        ];

        await sock.sendMessage(from, {
            text: "🧪 *Test 3: List Message*\nSelect a command category:",
            footer: "Gabimaru | Tap to pick",
            title: "📋 Command Menu",
            buttonText: "🔽 Open Menu",
            sections,
            listType: 1
        }, { quoted: msg });

        return "✅ Test 3 sent";
    } catch (e) {
        return `❌ Test 3 failed: ${e.message}`;
    }
}

// ─── Test 4 — Image with Buttons ────────────────────────────────────────────
async function testImageButtons(sock, from, msg) {
    try {
        const buttons = [
            { buttonId: "img_btn_1", buttonText: { displayText: "👍 Nice" }, type: 1 },
            { buttonId: "img_btn_2", buttonText: { displayText: "🔁 Resend" }, type: 1 },
        ];

        await sock.sendMessage(from, {
            image: { url: "https://i.imgur.com/4YPEQV1.png" },
            caption: "🧪 *Test 4: Image + Buttons*\nImage with interactive buttons below:",
            footer: "Gabimaru Button Test",
            buttons,
            headerType: 4  // 4 = image header
        }, { quoted: msg });

        return "✅ Test 4 sent";
    } catch (e) {
        return `❌ Test 4 failed: ${e.message}`;
    }
}

// ─── Test 5 — External Ad Reply (Channel-style card) ────────────────────────
async function testAdReply(sock, from, msg) {
    try {
        await sock.sendMessage(from, {
            text: "🧪 *Test 5: External Ad Reply*\nFancy card with thumbnail and link:",
            contextInfo: {
                mentionedJid: [from],
                externalAdReply: {
                    showAdAttribution: true,
                    renderLargerThumbnail: true,
                    title: "Gabimaru The Hollow 🥷",
                    body: "WhatsApp Bot | Node.js & Baileys",
                    previewType: "PHOTO",
                    thumbnailUrl: "https://i.imgur.com/4YPEQV1.png",
                    sourceUrl: "https://github.com/Gabimaru-Dev",
                    mediaUrl: "https://github.com/Gabimaru-Dev",
                    mediaType: 1
                }
            }
        }, { quoted: fakeQuote(from) });

        return "✅ Test 5 sent";
    } catch (e) {
        return `❌ Test 5 failed: ${e.message}`;
    }
}

// ─── Test 6 — Poll Message ───────────────────────────────────────────────────
async function testPoll(sock, from, msg) {
    try {
        await sock.sendMessage(from, {
            poll: {
                name: "🧪 Test 6: Poll — Which feature do you like most?",
                values: ["🤖 AI Chatbot", "🎭 Stickers", "🛡️ Group Tools", "📥 Downloaders"],
                selectableCount: 1  // 0 = multi-select, 1+ = single
            }
        }, { quoted: msg });

        return "✅ Test 6 sent";
    } catch (e) {
        return `❌ Test 6 failed: ${e.message}`;
    }
}

// ─── Main Plugin ─────────────────────────────────────────────────────────────
module.exports = {
    command: ["btntest", "buttontest"],
    description: "Test all WhatsApp interactive message types (buttons, lists, polls, ad replies)",

    async run({ sock, msg, from, args, settings }) {
        await react01(sock, from, msg.key, 1000);

        const testNum = args[0];

        // Show usage if no argument
        if (!testNum) {
            return sock.sendMessage(from, {
                text: `🧪 *WhatsApp Button Tests*\n\n` +
                      `Usage: *${settings.prefix}btntest <number>*\n\n` +
                      `*1* → Plain Buttons (3 quick-reply buttons)\n` +
                      `*2* → Template Buttons (URL + Call + Reply)\n` +
                      `*3* → List Message (sections & rows)\n` +
                      `*4* → Image with Buttons\n` +
                      `*5* → External Ad Reply (card)\n` +
                      `*6* → Poll Message\n` +
                      `*7* → Run ALL tests in sequence\n\n` +
                      `_Note: Some types may not render on all WhatsApp versions._`
            }, { quoted: msg });
        }

        // Run all tests
        if (testNum === "7") {
            await sock.sendMessage(from, { text: "🚀 Running all button tests..." }, { quoted: msg });

            const tests = [
                testPlainButtons,
                testTemplateButtons,
                testListMessage,
                testImageButtons,
                testAdReply,
                testPoll,
            ];

            const results = [];
            for (const test of tests) {
                const result = await test(sock, from, msg);
                results.push(result);
                await delay(1500); // small gap between sends
            }

            return sock.sendMessage(from, {
                text: `📊 *Test Results:*\n\n${results.join("\n")}`
            }, { quoted: msg });
        }

        // Run individual test
        const testMap = {
            "1": testPlainButtons,
            "2": testTemplateButtons,
            "3": testListMessage,
            "4": testImageButtons,
            "5": testAdReply,
            "6": testPoll,
        };

        const testFn = testMap[testNum];
        if (!testFn) {
            return sock.sendMessage(from, {
                text: `❌ Invalid test number. Use 1–7.\nTry: *${settings.prefix}btntest* for usage.`
            }, { quoted: msg });
        }

        const result = await testFn(sock, from, msg);
        await sock.sendMessage(from, { text: result }, { quoted: msg });
    }
};
