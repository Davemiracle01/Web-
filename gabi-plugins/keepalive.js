const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { react01 } = require('../lib/extra');
const DATA_FILE = path.join(__dirname, "..", "keepalive.json");
const pingerMap = new Map(); // store { url: interval }
let urls = [];

// Load existing URLs from file on startup
if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE));
    if (Array.isArray(saved)) {
      urls = saved;
      for (const url of urls) {
        const interval = setInterval(() => {
          axios.get(url).then(() => {
            console.log(`✅ Keepalive: ${url}`);
          }).catch(e => {
            console.log(`❌ Ping failed: ${url} - ${e.message}`);
          });
        }, 240000); // every 4 mins
        pingerMap.set(url, interval);
      }
    }
  } catch (e) {
    console.error("Failed to load keepalive.json:", e.message);
  }
}

// Save to file helper
function saveToFile() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(Array.from(pingerMap.keys()), null, 2));
}

module.exports = {
  command: ["keepalive"],
  description: "Ping a URL every few minutes to keep it alive",

  async run({ msg, sock, text, from }) {
  await react01(sock, from, msg.key, 2000);
    const input = text.trim();

    if (!input)
      return sock.sendMessage(from, { text: "🚫 Example: .keepalive https://your-url.com" }, { quoted: msg });

    if (input === "list") {
      const list = Array.from(pingerMap.keys());
      return sock.sendMessage(from, {
        text: list.length
          ? "🌐 Active KeepAlive URLs:\n" + list.map((url, i) => `• ${i + 1}. ${url}`).join("\n")
          : "⚠️ No keepalive sessions are active."
      }, { quoted: msg });
    }

    if (input.startsWith("stop ")) {
      const url = input.split(" ")[1];
      if (pingerMap.has(url)) {
        clearInterval(pingerMap.get(url));
        pingerMap.delete(url);
        saveToFile();
        return sock.sendMessage(from, { text: `🛑 Stopped keepalive for ${url}` }, { quoted: msg });
      } else {
        return sock.sendMessage(from, { text: `❌ No keepalive found for ${url}` }, { quoted: msg });
      }
    }

    const url = input;

    if (!/^https?:\/\//.test(url))
      return sock.sendMessage(from, { text: "❌ Invalid URL. Include http:// or https://" }, { quoted: msg });

    if (pingerMap.has(url))
      return sock.sendMessage(from, { text: `⚠️ Already pinging ${url}` }, { quoted: msg });

    const interval = setInterval(() => {
      axios.get(url).then(() => {
        console.log(`✅ Keepalive: ${url}`);
      }).catch(e => {
        console.log(`❌ Ping failed: ${url} - ${e.message}`);
      });
    }, 240000); // every 4 mins

    pingerMap.set(url, interval);
    saveToFile();

    sock.sendMessage(from, {
      text: `✅ Keepalive started for:\n${url}\n\nPing every 4 mins. Use ".keepalive stop ${url}" to stop.`
    }, { quoted: msg });
  }
};