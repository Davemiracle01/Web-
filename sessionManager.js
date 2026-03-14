/**
 * sessionManager.js
 * Manages active WhatsApp sessions for multi-session web bot support
 */

const activeSessions = new Map();

function addSession(number, session) {
  activeSessions.set(number, {
    session,
    connected: true,
    lastActivity: Date.now()
  });
  console.log(`✅ Session added: ${number} | Total active: ${activeSessions.size}`);
}

function removeSession(number) {
  activeSessions.delete(number);
  console.log(`🗑️ Session removed: ${number} | Total active: ${activeSessions.size}`);
}

function updateSessionStatus(number, connected) {
  const data = activeSessions.get(number);
  if (data) {
    data.connected = connected;
    data.lastActivity = Date.now();
  }
}

function getAllSessions() {
  const valid = [];
  for (const [number, data] of activeSessions.entries()) {
    if (data.connected) valid.push([number, data.session]);
  }
  return valid;
}

function getSessionCount() {
  return getAllSessions().length;
}

function getSessionByNumber(number) {
  const data = activeSessions.get(number);
  return data && data.connected ? data.session : null;
}

// Auto-clean disconnected sessions after 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [number, data] of activeSessions.entries()) {
    if (!data.connected && now - data.lastActivity > 300000) {
      activeSessions.delete(number);
      console.log(`🧹 Cleaned stale session: ${number}`);
    }
  }
}, 60000);

module.exports = {
  addSession,
  removeSession,
  updateSessionStatus,
  getAllSessions,
  getSessionCount,
  getSessionByNumber
};
