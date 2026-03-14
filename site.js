/**
 * site.js - Gabimaru Bot Web Server
 * Provides web-based pairing, dashboard, user management
 * Based on TMK pair site architecture
 */

const express = require("express");
const session = require("express-session");
const startpairing = require("./pair");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { autoLoadPairs } = require("./autoload");
const { getAllSessions } = require("./sessionManager");

const app = express();
app.set("json spaces", 2);
const PORT = process.env.PORT || 2010;

// ── Paths ─────────────────────────────────────────────────────────────────────
const pairedNumbersPath = path.join(__dirname, "sesFolder", "pairedNumbers.json");
const pairingCodePath   = path.join(__dirname, "richstore", "pairing", "pairing.json");
const usersPath         = path.join(__dirname, "richstore", "users.json");

// ── Ensure required files exist ───────────────────────────────────────────────
[
  { file: pairedNumbersPath, def: { numbers: [] } },
  { file: usersPath,         def: { users: [] } },
  { file: pairingCodePath,   def: {} },
].forEach(({ file, def }) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(def, null, 2));
});

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(session({
  secret: "gabimaru_hollow_secret",
  resave: false,
  saveUninitialized: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "frontend"), { index: false }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(usersPath, "utf8")).users || []; }
  catch { return []; }
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
function requireLogin(req, res, next) {
  if (req.session.loggedIn) return next();
  res.redirect("/login.html");
}
function requireAdmin(req, res, next) {
  if (req.session.loggedIn && req.session.username === "admin") return next();
  res.redirect("/adminlogin.html");
}

// ── Auth routes ───────────────────────────────────────────────────────────────
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, message: "All fields required." });
  const users = loadUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ success: false, message: "Username taken." });
  users.push({ username, password, pairings: [] });
  saveUsers(users);
  req.session.loggedIn = true;
  req.session.username = username;
  res.json({ success: true });
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const settings = JSON.parse(fs.readFileSync("./settings.json"));
  // Admin check
  if (username === "admin" && password === (settings.adminPassword || "admin123")) {
    req.session.loggedIn = true; req.session.username = "admin";
    return res.json({ success: true });
  }
  const user = loadUsers().find(u => u.username === username && u.password === password);
  if (user) {
    req.session.loggedIn = true; req.session.username = username;
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: "Invalid credentials." });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login.html"));
});

app.get("/me", (req, res) => {
  if (!req.session.loggedIn) return res.status(401).json({ success: false });
  const user = loadUsers().find(u => u.username === req.session.username);
  if (!user) return res.status(404).json({ success: false });
  res.json({ username: user.username, pairings: user.pairings || [] });
});

// ── Pairing routes ────────────────────────────────────────────────────────────
let currentPairingNumber = null;

app.get("/pair", requireLogin, async (req, res) => {
  let number = (req.query.number || "").replace(/\s+/g, "").replace(/^\+/, "");
  if (!number) return res.status(400).json({ success: false, message: "Phone number required." });
  if (!/^\d+$/.test(number)) return res.status(400).json({ success: false, message: "Digits only." });
  if (number.length < 11 || number.length > 15) return res.status(400).json({ success: false, message: "Include country code (e.g. 2349012345678)." });

  const users = loadUsers();
  const user = users.find(u => u.username === req.session.username);
  if (!user) return res.status(401).json({ success: false, message: "User not found." });

  user.pairings = user.pairings || [];
  if (user.pairings.includes(number)) return res.status(409).json({ success: false, message: "Number already paired." });
  if (user.pairings.length >= 2) return res.status(403).json({ success: false, message: "Maximum 2 pairings reached." });

  currentPairingNumber = number;

  try {
    // Delete old pairing code so frontend doesn't show stale one
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
  } catch {
    res.status(500).json({ error: "Error reading pairing code." });
  }
});

app.get("/paired", requireLogin, (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8"));
    res.json({ numbers: data.numbers });
  } catch {
    res.status(500).json({ error: "Could not load paired numbers." });
  }
});

app.delete("/paired/:number", requireLogin, (req, res) => {
  const number = req.params.number;
  try {
    const data = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8"));
    data.numbers = data.numbers.filter(n => n !== number);
    fs.writeFileSync(pairedNumbersPath, JSON.stringify(data, null, 2));

    const users = loadUsers();
    const user = users.find(u => u.username === req.session.username);
    if (user) { user.pairings = (user.pairings || []).filter(n => n !== number); saveUsers(users); }

    const sessionDir = path.join(__dirname, "richstore", "pairing", number);
    if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });

    res.json({ success: true, message: `Deleted ${number}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/reload-session", requireLogin, async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).json({ success: false, message: "Number required." });
  try {
    await startpairing(number);
    res.json({ success: true, message: `Reloaded session for ${number}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin routes ───────────────────────────────────────────────────────────────
app.get("/admin-data", requireAdmin, (req, res) => {
  const users = loadUsers();
  let paired = [];
  try { paired = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8")).numbers || []; } catch {}
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const start = (page - 1) * limit;
  res.json({
    users: users.slice(start, start + limit),
    paired,
    totalUsers: users.length,
    page, limit,
    totalPages: Math.ceil(users.length / limit)
  });
});

app.get("/admin/ses-status", requireAdmin, (req, res) => {
  const sessions = getAllSessions().map(([num]) => ({
    number: num.replace(/@s\.whatsapp\.net$/, ""),
    status: "active"
  }));
  res.json({ success: true, totalSessions: sessions.length, sessions });
});

app.get("/admin/react", requireAdmin, async (req, res) => {
  const { channelmsglink, emoji } = req.query;
  if (!channelmsglink) return res.status(400).json({ success: false, message: "channelmsglink is required." });

  const sessions = getAllSessions();
  if (sessions.length === 0) return res.status(503).json({ success: false, message: "No active sessions available." });

  // Parse newsletter ID and message ID from link
  // Format: https://whatsapp.com/channel/<id>/<msgid>
  const match = channelmsglink.match(/channel\/([^/]+)(?:\/([^/?]+))?/);
  if (!match) return res.status(400).json({ success: false, message: "Invalid channel message link." });

  const newsletterId = match[1] + "@newsletter";
  const messageId = match[2] || null;

  const results = [];
  for (const [jid, sock] of sessions) {
    try {
      await sock.newsletterReactMessage(newsletterId, messageId, emoji || "❤️");
      results.push({ number: jid.replace(/@s\.whatsapp\.net$/, ""), success: true });
    } catch (e) {
      results.push({ number: jid.replace(/@s\.whatsapp\.net$/, ""), success: false, error: e.message });
    }
  }

  const successful = results.filter(r => r.success).length;
  res.json({
    success: true,
    message: `Reacted on ${successful}/${sessions.length} sessions.`,
    summary: { successful, totalSessions: sessions.length },
    target: { newsletterId, messageId },
    details: results
  });
});

app.get("/admin/idch", requireAdmin, async (req, res) => {
  const { inviteCode } = req.query;
  if (!inviteCode) return res.status(400).json({ success: false, message: "inviteCode is required." });

  const sessions = getAllSessions();
  if (sessions.length === 0) return res.status(503).json({ success: false, message: "No active sessions available." });

  try {
    const [, sock] = sessions[0];
    const metadata = await sock.getNewsletterInfo("https://whatsapp.com/channel/" + inviteCode);
    res.json({ success: true, metadata });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get("/reload-user", requireAdmin, async (req, res) => {
  const { number } = req.query;
  if (!number) return res.status(400).json({ success: false, message: "Number required." });
  try {
    await startpairing(number);
    res.json({ success: true, message: `Reloaded session for ${number}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete("/admin/users/:username", requireAdmin, (req, res) => {
  let users = loadUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ success: false, message: "User not found." });

  // Remove pairings
  const data = JSON.parse(fs.readFileSync(pairedNumbersPath, "utf8"));
  data.numbers = data.numbers.filter(n => !(user.pairings || []).includes(n));
  fs.writeFileSync(pairedNumbersPath, JSON.stringify(data, null, 2));
  (user.pairings || []).forEach(num => {
    const dir = path.join(__dirname, "richstore", "pairing", num);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  users = users.filter(u => u.username !== req.params.username);
  saveUsers(users);
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

// ── Page routes ────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "frontend", "index.html")));
app.get("/admin", (req, res) => res.sendFile(path.join(__dirname, "frontend", "admin.html")));

// ── Start server ───────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ TMK Site Server is running on port ${PORT}`);

  try {
    const ipRes = await axios.get('https://api.ipify.org?format=json');
    const ip = ipRes.data.ip;

    console.log(`🌐 Public Access URL: http://${ip}:${PORT}`);
    console.log(`- Login Page:       http://${ip}:${PORT}/login.html`);
    console.log(`- Dashboard Page:   http://${ip}:${PORT}/dashboard`);
  } catch (err) {
    console.log("⚠️ Couldn't fetch public IP. Use your server panel IP manually.");
  }

  await autoLoadPairs({ concurrent: false, batchSize: 100 });
});

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
