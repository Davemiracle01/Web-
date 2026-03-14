const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '..', 'groupConfig.json');
if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, '{}');
const { react01 } = require('../lib/extra');
const loadConfig = () => JSON.parse(fs.readFileSync(configPath));
const saveConfig = (data) => fs.writeFileSync(configPath, JSON.stringify(data, null, 2));

module.exports = {
  command: ['welcome', 'bye'],
  isGroup: true,
  isSudo: true,
  run: async ({ sock, msg, from, args, commandName }) => {
  await react01(sock, from, msg.key, 2000);
    const config = loadConfig();
    const sub = args[0]?.toLowerCase();
    const isWelcome = commandName === 'welcome';
    const groupId = from;

    if (!config[groupId]) {
      config[groupId] = {
        welcome: { on: false, msg: '👋 Welcome @user!' },
        bye: { on: false, msg: '👋 Goodbye @user.' }
      };
    }

    if (sub === 'on' || sub === 'off') {
      config[groupId][isWelcome ? 'welcome' : 'bye'].on = sub === 'on';
      saveConfig(config);
      return sock.sendMessage(from, {
        text: `✅ ${isWelcome ? 'Welcome' : 'Bye'} message *${sub === 'on' ? 'enabled' : 'disabled'}*.`
      }, { quoted: msg });
    }

    if (args.length > 0) {
      config[groupId][isWelcome ? 'welcome' : 'bye'].msg = args.join(' ');
      saveConfig(config);
      return sock.sendMessage(from, {
        text: `✅ ${isWelcome ? 'Welcome' : 'Bye'} message updated:\n${args.join(' ')}`
      }, { quoted: msg });
    }

    const usage = `📌 Usage:
.welcome on/off - Choose welcome mode
.welcome [msg] - Set welcome message (use @user)
.bye on/off - Choose goodbye mode
.bye [msg] - Set goodbye message (use @user)`;

    return sock.sendMessage(from, { text: usage }, { quoted: msg });
  }
};