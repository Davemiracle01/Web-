/**
 * bananas31.js — BANANAS31/USDT Signal Plugin
 * Fetches live Binance candle data every 60s
 * Analyzes RSI + volume + candle patterns
 * Sends dramatic alerts on BUY/SELL signal change
 * Destination: newsletter JID from pair.js
 */

const axios = require("axios");

// ── Config ────────────────────────────────────────────────────────────────────
const SYMBOL       = "BANANAS31USDT";
const INTERVAL     = "5m";
const CHECK_EVERY  = 60 * 1000; // 60 seconds
const RSI_PERIOD   = 14;

// Send signals to these — newsletters from pair.js
const SIGNAL_DESTINATIONS = [
  "120363404343008289@newsletter",
  "120363363333127547@newsletter",
    "254789951753@s.whatsapp.net",
      "254769279076@s.whatsapp.net",
];

// ── State ─────────────────────────────────────────────────────────────────────
let lastSignal   = null; // "BUY" | "SELL" | null
let signalTimer  = null;
let activeSock   = null;

// ── RSI Calculation ───────────────────────────────────────────────────────────
function calcRSI(closes) {
  if (closes.length < RSI_PERIOD + 1) return null;
  const slice = closes.slice(-(RSI_PERIOD + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains  += diff;
    else          losses -= diff;
  }
  const avgGain = gains  / RSI_PERIOD;
  const avgLoss = losses / RSI_PERIOD;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ── Fetch candles from Binance public API ─────────────────────────────────────
async function fetchCandles() {
  const url = `https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${INTERVAL}&limit=50`;
  const { data } = await axios.get(url, { timeout: 10000 });
  return data.map(c => ({
    open:   parseFloat(c[1]),
    high:   parseFloat(c[2]),
    low:    parseFloat(c[3]),
    close:  parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

// ── Analyze signal ────────────────────────────────────────────────────────────
function analyze(candles) {
  const closes  = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const rsi     = calcRSI(closes);

  const last    = candles[candles.length - 1];
  const prev    = candles[candles.length - 2];
  const price   = last.close;

  // Average volume of last 20 candles
  const avgVol  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const highVol = last.volume > avgVol * 1.5;

  // Candle pattern: bullish/bearish engulfing
  const bullEngulf = last.close > last.open &&
                     last.open  < prev.close &&
                     last.close > prev.open;

  const bearEngulf = last.close < last.open &&
                     last.open  > prev.close &&
                     last.close < prev.open;

  let signal = null;

  if (rsi !== null) {
    if (rsi < 35 && highVol && bullEngulf) signal = "BUY";
    else if (rsi > 65 && highVol && bearEngulf) signal = "SELL";
    else if (rsi < 30) signal = "BUY";
    else if (rsi > 70) signal = "SELL";
  }

  return { signal, rsi: rsi?.toFixed(2), price, volume: last.volume.toFixed(2), avgVol: avgVol.toFixed(2), highVol };
}

// ── Build dramatic messages ───────────────────────────────────────────────────
function buildMessages(signal, data) {
  const { rsi, price, volume, avgVol, highVol } = data;
  const p = parseFloat(price).toFixed(6);
  const now = new Date().toUTCString();

  if (signal === "BUY") return [
    `🚨🚨🚨 *SIGNAL ALERT* 🚨🚨🚨\n\n🍌 *BANANAS31/USDT — BUY NOW* 🍌\n\n📈 Price: *$${p}*\n📊 RSI: *${rsi}* (OVERSOLD)\n💥 Volume: ${highVol ? "PUMPING 🔥" : "Normal"}\n\n⚡ THE MARKET IS SCREAMING BUY ⚡`,
    `🔥🔥 *DON'T MISS THIS* 🔥🔥\n\n🍌 BANANAS31 is at a DISCOUNT right now!\n\n💰 *BUY BUY BUY*\n📉 RSI: ${rsi} — Deeply oversold\n🕐 ${now}\n\nThis signal does NOT come often 👀`,
    `😤 *ARE YOU WATCHING?* 😤\n\n🍌 BANANAS31 screaming *BUY*\n\nRSI: ${rsi} | Price: $${p}\nVolume spike: ${highVol ? "YES 🚀" : "mild"}\n\nSet your entry NOW before it moves!`,
    `🧠 *SMART MONEY IS BUYING* 🧠\n\n🍌 BANANAS31/USDT\n💵 Entry zone: *$${p}*\n📊 RSI ${rsi} — classic reversal territory\n\nThis is not financial advice but... 👀📈`,
    `🏁 *FINAL CALL — BUY SIGNAL* 🏁\n\n🍌 BANANAS31 | $${p}\n⚡ RSI: ${rsi} | Vol: ${volume} (avg: ${avgVol})\n\n*Signal confirmed. Act accordingly.* 🫡`,
  ];

  return [
    `🚨🚨🚨 *SIGNAL ALERT* 🚨🚨🚨\n\n🍌 *BANANAS31/USDT — SELL NOW* 🍌\n\n📉 Price: *$${p}*\n📊 RSI: *${rsi}* (OVERBOUGHT)\n💥 Volume: ${highVol ? "DUMPING 🧨" : "Normal"}\n\n⚡ THE MARKET IS SCREAMING SELL ⚡`,
    `🔥🔥 *GET OUT NOW* 🔥🔥\n\n🍌 BANANAS31 is TOPPING OUT!\n\n💸 *SELL SELL SELL*\n📈 RSI: ${rsi} — Extremely overbought\n🕐 ${now}\n\nDon't be the last one holding the bag 🛍️`,
    `😤 *DISTRIBUTION DETECTED* 😤\n\n🍌 BANANAS31 screaming *SELL*\n\nRSI: ${rsi} | Price: $${p}\nVolume spike: ${highVol ? "YES 🧨" : "mild"}\n\nTake your profits before the drop!`,
    `🧠 *SMART MONEY IS SELLING* 🧠\n\n🍌 BANANAS31/USDT\n💵 Exit zone: *$${p}*\n📊 RSI ${rsi} — overbought exhaustion\n\nThis is not financial advice but... 👀📉`,
    `🏁 *FINAL CALL — SELL SIGNAL* 🏁\n\n🍌 BANANAS31 | $${p}\n⚡ RSI: ${rsi} | Vol: ${volume} (avg: ${avgVol})\n\n*Signal confirmed. Protect your gains.* 🫡`,
  ];
}

// ── Send messages to all destinations ────────────────────────────────────────
async function sendSignal(sock, signal, data) {
  const messages = buildMessages(signal, data);
  for (const jid of SIGNAL_DESTINATIONS) {
    for (const text of messages) {
      try {
        await sock.sendMessage(jid, { text });
        await new Promise(r => setTimeout(r, 1500)); // small delay between msgs
      } catch (e) {
        console.error(`[bananas31] Failed to send to ${jid}:`, e.message);
      }
    }
  }
}

// ── Main check loop ───────────────────────────────────────────────────────────
async function checkSignal(sock) {
  try {
    const candles = await fetchCandles();
    const result  = analyze(candles);

    if (result.signal && result.signal !== lastSignal) {
      console.log(`[bananas31] Signal changed: ${lastSignal} → ${result.signal} | RSI: ${result.rsi} | Price: ${result.price}`);
      lastSignal = result.signal;
      await sendSignal(sock, result.signal, result);
    } else {
      console.log(`[bananas31] No signal change (${result.signal || "HOLD"}) | RSI: ${result.rsi} | Price: ${result.price}`);
    }
  } catch (e) {
    console.error("[bananas31] Check error:", e.message);
  }
}

// ── Start / Stop helpers ──────────────────────────────────────────────────────
function startMonitor(sock) {
  activeSock = sock;
  if (signalTimer) clearInterval(signalTimer);
  checkSignal(sock); // run immediately on start
  signalTimer = setInterval(() => checkSignal(sock), CHECK_EVERY);
  console.log("[bananas31] Monitor started — checking every 60s");
}

function stopMonitor() {
  if (signalTimer) { clearInterval(signalTimer); signalTimer = null; }
  console.log("[bananas31] Monitor stopped");
}

// ── Plugin export ─────────────────────────────────────────────────────────────
module.exports = {
  command: ["bananas", "bananas31", "bsignal"],
  description: "BANANAS31/USDT signal monitor — RSI + volume + candle analysis",
  isOwner: true,

  // Auto-start when the plugin loads (first active session picks it up)
  onLoad(sock) {
    startMonitor(sock);
  },

  async run({ sock, msg, from, args, settings }) {
    const sub = (args[0] || "").toLowerCase();

    if (sub === "stop") {
      stopMonitor();
      return sock.sendMessage(from, { text: "🔴 BANANAS31 monitor stopped." }, { quoted: msg });
    }

    if (sub === "start") {
      startMonitor(sock);
      return sock.sendMessage(from, { text: "🟢 BANANAS31 monitor started. Checking every 60s." }, { quoted: msg });
    }

    if (sub === "check") {
      await sock.sendMessage(from, { text: "🔍 Fetching BANANAS31 signal..." }, { quoted: msg });
      try {
        const candles = await fetchCandles();
        const result  = analyze(candles);
        const status  = result.signal ? `*${result.signal}* 🚨` : "HOLD / No clear signal";
        return sock.sendMessage(from, {
          text: `🍌 *BANANAS31/USDT*\n\nSignal: ${status}\nRSI: ${result.rsi}\nPrice: $${parseFloat(result.price).toFixed(6)}\nVolume: ${result.volume} (avg: ${result.avgVol})\nHigh Vol: ${result.highVol ? "Yes 🔥" : "No"}\n\nMonitor: ${signalTimer ? "🟢 Running" : "🔴 Stopped"}\nLast signal sent: ${lastSignal || "None"}`
        }, { quoted: msg });
      } catch (e) {
        return sock.sendMessage(from, { text: `❌ Error: ${e.message}` }, { quoted: msg });
      }
    }

    // Default: show status
    await sock.sendMessage(from, {
      text: `🍌 *BANANAS31 Signal Bot*\n\nStatus: ${signalTimer ? "🟢 Running" : "🔴 Stopped"}\nLast signal: ${lastSignal || "None yet"}\nDestinations: ${SIGNAL_DESTINATIONS.length} JID(s)\n\nCommands:\n› *.bananas check* — force check now\n› *.bananas start* — start monitor\n› *.bananas stop* — stop monitor`
    }, { quoted: msg });
  }
};
