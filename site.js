/**
 * site.js — Gabimaru Bot Web Server
 */

const express  = require("express");
const session  = require("express-session");
const startpairing = require("./pair");
const fs       = require("fs");
const path     = require("path");
const axios    = require("axios");
const { autoLoadPairs } = require("./autoload");
const { getAllSessions } = require("./sessionManager");

const app  = express();
const PORT = process.env.PORT || 2010;

app.set("json spaces", 2);
app.set("trust proxy", 1);

// Paths
const pairedNumbersPath = path.join(__dirname, "sesFolder", "pairing.json");
const pairingCodePath   = path.join(__dirname, "richstore", "pairing", "pairing.json");
const usersPath         = path.join(__dirname, "richstore", "users.json");

// Ensure required files exist
[
  { file: pairedNumbersPath, def: { numbers: [] } },
  { file: usersPath,         def: { users: [] } },
  { file: pairingCodePath,   def: {} },
].forEach(({ file, def }) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def, null, 2));
});

// Middleware
const SESSION_SECRET = process.env.SESSION_SECRET || "gabimaru_hollow_secret_2025";
if (!process.env.SESSION_SECRET) console.warn("⚠️  Set SESSION_SECRET env var for production security.");

app.use(session({
  secret:            SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   !!process.env.DYNO,
    httpOnly: true,
    sameSite: "lax",
    maxAge:   7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "frontend"), { index: false }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Helpers
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(usersPath, "utf8")).users || []; } catch { return []; }
}
function saveUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify({ users }, null, 2));
}
function saveNumber(number) {
  let list = { numbers: [] };
  try { list = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8")); } catch {}
  if (!list.numbers.includes(number)) {
    list.numbers.push(number);
    fs.writeFileSync(pairedNumbersPath, JSON.stringify(list, null, 2));
  }
}

// Settings cache for login (avoids disk read on every POST /login)
let settingsCache = null;
let settingsCacheTime = 0;
function getSettings() {
  if (!settingsCache || Date.now() - settingsCacheTime > 30000) {
    try { settingsCache = JSON.parse(fs.readFileSync("./settings.json", "utf8")); }
    catch { settingsCache = {}; }
    settingsCacheTime = Date.now();
  }
  return settingsCache;
}

function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login.html");
}
function requireAdmin(req, res, next) {
  if (req.session.loggedIn && req.session.username === "admin") return next();
  res.redirect("/adminlogin.html");
}

// Rate limiting for pairing (max 3 pairings per 10 minutes per IP)
const pairRateMap = new Map();
function pairRateLimit(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();
  const win = 10 * 60 * 1000;
  if (!pairRateMap.has(ip)) pairRateMap.set(ip, []);
  const hits = pairRateMap.get(ip).filter(t => now - t < win);
  if (hits.length >= 3) return res.status(429).json({ success: false, message: "Too many pairing attempts. Wait 10 minutes." });
  hits.push(now);
  pairRateMap.set(ip, hits);
  next();
}
// Clean rate map every hour
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of pairRateMap.entries()) {
    const fresh = times.filter(t => now - t < 600000);
    if (!fresh.length) pairRateMap.delete(ip);
    else pairRateMap.set(ip, fresh);
  }
}, 3600000);

// Auth routes
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password?.trim()) return res.status(400).json({ success: false, message: "All fields required." });
  if (username.length < 3) return res.status(400).json({ success: false, message: "Username too short." });
  const users = loadUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ success: false, message: "Username taken." });
  users.push({ username, password, pairings: [] });
  saveUsers(users);
  req.session.loggedIn  = true;
  req.session.username  = username;
  req.session.save(err => {
    if (err) return res.status(500).json({ success: false, message: "Session error." });
    res.json({ success: true });
  });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const settings = getSettings();
  if (username === "admin" && password === (settings.adminPassword || "admin123")) {
    req.session.loggedIn = true; req.session.username = "admin";
    return res.json({ success: true });
  }
  const user = loadUsers().find(u => u.username === username && u.password === password);
  if (user) {
    req.session.loggedIn = true; req.session.username = username;
    return req.session.save(err => {
      if (err) return res.status(500).json({ success: false, message: "Session error." });
      res.json({ success: true });
    });
  }
  res.status(401).json({ success: false, message: "Invalid credentials." });
});

app.get("/logout", (req, res) => { req.session.destroy(() => res.redirect("/login.html")); });

app.get("/me", (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ success: false });
  const user = loadUsers().find(u => u.username === req.session.username);
  if (!user) return res.status(404).json({ success: false });
  res.json({ username: user.username, pairings: user.pairings || [] });
});

// Pairing routes
let currentPairingNumber = null;

app.get("/pair", requireLogin, pairRateLimit, async (req, res) => {
  let number = (req.query.number || "").replace(/\s+/g, "").replace(/^\+/, "");
  if (!number)                                          return res.status(400).json({ success: false, message: "Phone number required." });
  if (!/^\d+$/.test(number))                           return res.status(400).json({ success: false, message: "Digits only." });
  if (number.length < 11 || number.length > 15)        return res.status(400).json({ success: false, message: "Include country code (e.g. 2349012345678)." });

  const users = loadUsers();
  const user  = users.find(u => u.username === req.session.username);
  if (!user) return res.status(401).json({ success: false, message: "User not found." });

  user.pairings = user.pairings || [];
  if (user.pairings.includes(number)) return res.status(409).json({ success: false, message: "Already paired." });
  if (user.pairings.length >= 5)      return res.status(403).json({ success: false, message: "Max 5 pairings reached." });

  currentPairingNumber = number;
  try {
    if (fs.existsSync(pairingCodePath)) fs.writeFileSync(pairingCodePath, "{}");
    await startpairing(number);
    saveNumber(number);
    user.pairings.push(number);
    saveUsers(users);
    res.json({ success: true, message: "Pairing started. Poll /pairing-code for the code." });
  } catch (e) {
    res.status(500).json({ success: false, message: "Pairing failed: " + e.message });
  }
});

app.get("/pairing-code", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(pairingCodePath, "utf8"));
    if (data.code) return res.json({ code: data.code, number: currentPairingNumber });
    res.status(404).json({ error: "Code not ready yet." });
  } catch { res.status(500).json({ error: "Error reading pairing code." }); }
});

app.get("/paired", requireLogin, (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8"));
    res.json({ numbers: data.numbers });
  } catch { res.status(500).json({ error: "Could not load paired numbers." }); }
});

app.delete("/paired/:number", requireLogin, (req, res) => {
  const number = req.params.number;
  try {
    const data = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8"));
    data.numbers = data.numbers.filter(n => n !== number);
    fs.writeFileSync(pairedNumbersPath, JSON.stringify(data, null, 2));
    const users = loadUsers();
    const user  = users.find(u => u.username === req.session.username);
    if (user) { user.pairings = (user.pairings || []).filter(n => n !== number); saveUsers(users); }
    const dir = path.join(__dirname, "richstore", "pairing", number);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    res.json({ success: true, message: `Deleted ${number}.` });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get("/reload-session", requireLogin, async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).json({ success: false, message: "Number required." });
  try { await startpairing(number); res.json({ success: true, message: `Reloaded ${number}.` }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Admin routes
app.get("/admin-data", requireAdmin, (req, res) => {
  const users = loadUsers();
  let paired = [];
  try { paired = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8")).numbers || []; } catch {}
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 10);
  const start = (page - 1) * limit;
  res.json({ users: users.slice(start, start + limit), paired, totalUsers: users.length, page, limit, totalPages: Math.ceil(users.length / limit) });
});

app.get("/admin/ses-status", requireAdmin, (req, res) => {
  const sessions = getAllSessions().map(([num]) => ({ number: num.replace(/@s\.whatsapp\.net$/, ""), status: "active" }));
  res.json({ success: true, totalSessions: sessions.length, sessions });
});

app.get("/admin/react", requireAdmin, async (req, res) => {
  const { channelmsglink, emoji } = req.query;
  if (!channelmsglink) return res.status(400).json({ success: false, message: "channelmsglink required." });
  const sessions = getAllSessions();
  if (!sessions.length) return res.status(503).json({ success: false, message: "No active sessions." });
  const match = channelmsglink.match(/channel\/([^/]+)(?:\/([^/?]+))?/);
  if (!match) return res.status(400).json({ success: false, message: "Invalid channel link." });
  const newsletterId = match[1] + "@newsletter";
  const messageId    = match[2] || null;
  const results = [];
  for (const [jid, sock] of sessions) {
    try { await sock.newsletterReactMessage(newsletterId, messageId, emoji || "❤️"); results.push({ number: jid.replace(/@s\.whatsapp\.net$/, ""), success: true }); }
    catch (e) { results.push({ number: jid.replace(/@s\.whatsapp\.net$/, ""), success: false, error: e.message }); }
  }
  const ok = results.filter(r => r.success).length;
  res.json({ success: true, message: `Reacted ${ok}/${sessions.length}`, results });
});

app.get("/admin/idch", requireAdmin, async (req, res) => {
  const { inviteCode } = req.query;
  if (!inviteCode) return res.status(400).json({ success: false, message: "inviteCode required." });
  const sessions = getAllSessions();
  if (!sessions.length) return res.status(503).json({ success: false, message: "No active sessions." });
  try {
    const [, sock] = sessions[0];
    const meta = await sock.getNewsletterInfo("https://whatsapp.com/channel/" + inviteCode);
    res.json({ success: true, metadata: meta });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get("/reload-user", requireAdmin, async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).json({ success: false, message: "Number required." });
  try { await startpairing(number); res.json({ success: true, message: `Reloaded ${number}.` }); }
  catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.delete("/admin/users/:username", requireAdmin, (req, res) => {
  let users = loadUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });
  const data = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8"));
  data.numbers = data.numbers.filter(n => !(user.pairings || []).includes(n));
  fs.writeFileSync(pairedNumbersPath, JSON.stringify(data, null, 2));
  (user.pairings || []).forEach(num => {
    const dir = path.join(__dirname, "richstore", "pairing", num);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });
  saveUsers(users.filter(u => u.username !== req.params.username));
  res.json({ success: true, message: `${req.params.username} deleted.` });
});

app.delete("/admin/pairs/:number", requireAdmin, (req, res) => {
  const number = req.params.number;
  const data = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8"));
  data.numbers = data.numbers.filter(n => n !== number);
  fs.writeFileSync(pairedNumbersPath, JSON.stringify(data, null, 2));
  let users = loadUsers();
  users.forEach(u => { u.pairings = (u.pairings || []).filter(p => p !== number); });
  saveUsers(users);
  const dir = path.join(__dirname, "richstore", "pairing", number);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  res.json({ success: true, message: `Pair ${number} removed.` });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: Math.floor(process.uptime()), sessions: getAllSessions().length, memory: process.memoryUsage().heapUsed, timestamp: new Date().toISOString() });
});

// Page routes
app.get("/",      (req, res) => res.sendFile(path.join(__dirname, "frontend", "index.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "frontend", "admin.html")));

// Start
app.listen(PORT, "0.0.0.0", async () => {
  console.log(`✅ Gabimaru running on port ${PORT}`);

  if (process.env.DYNO) {
    console.log(`🟢 Heroku dyno: ${process.env.DYNO}`);
    if (process.env.APP_URL) {
      const pingUrl = process.env.APP_URL.replace(/\/$/, "") + "/health";
      setInterval(async () => {
        try { await axios.get(pingUrl, { timeout: 8000 }); }
        catch (e) { console.error(`[keepalive] failed: ${e.message}`); }
      }, 14 * 60 * 1000);
      console.log(`🔃 Keepalive → ${pingUrl}`);
    } else {
      console.log("⚠️  Set APP_URL for keepalive");
    }
  } else {
    try {
      const { data } = await axios.get("https://api.ipify.org?format=json");
      console.log(`🌐 http://${data.ip}:${PORT}`);
    } catch { console.log(`🌐 Running on port ${PORT}`); }
  }

  await autoLoadPairs({ concurrent: false, batchSize: 100 });
});

process.on("SIGTERM", () => { console.log("[SIGTERM] Shutting down..."); process.exit(0); });
process.on("uncaughtException",  err => console.error("[uncaughtException]",  err.message));
process.on("unhandledRejection", err => console.error("[unhandledRejection]", err?.message || err));
