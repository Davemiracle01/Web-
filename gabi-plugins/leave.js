const { react01 } = require('../lib/extra');

module.exports = {
  command: ["leave", "exit", "leavegc"],
  description: "Make bot leave the group",
  isGroup: true,
  isSudo: true,

  async run({ sock, msg, from }) {
    await react01(sock, from, msg.key, 2000);
    await sock.groupLeave(from);
  }
};
