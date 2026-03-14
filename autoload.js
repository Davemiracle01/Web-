/**
 * autoload.js
 * Auto-loads all previously paired sessions on startup
 */

const fs = require("fs").promises;
const path = require("path");
const chalk = require("chalk");

let isAutoLoadRunning = false;
let isShuttingDown = false;

process.on("SIGINT", () => { isShuttingDown = true; });
process.on("SIGTERM", () => { isShuttingDown = true; });

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processUser(number, index, total) {
  if (isShuttingDown) throw new Error("Shutdown in progress");
  console.log(chalk.blue(`⌛ Reconnecting ${index + 1}/${total}: ${number}`));

  const startpairing = require("./pair");
  await startpairing(number);

  console.log(chalk.green(`✅ Reconnected: ${number}`));
  return number;
}

async function processBatch(users, batchSize = 5) {
  const results = [];
  for (let i = 0; i < users.length; i += batchSize) {
    if (isShuttingDown) break;
    const batch = users.slice(i, i + batchSize);
    const promises = batch.map((user, idx) =>
      processUser(user, i + idx, users.length).catch(err => ({ user, error: err.message }))
    );
    const batchResults = await Promise.allSettled(promises);
    results.push(...batchResults);
    if (i + batchSize < users.length && !isShuttingDown) await delay(1500);
  }
  return results;
}

async function autoLoadPairs(options = {}) {
  if (isShuttingDown || isAutoLoadRunning) return;
  isAutoLoadRunning = true;

  console.log(chalk.yellow("🔄 Auto-loading all paired sessions..."));

  try {
    const pairingDir = path.join(__dirname, "richstore", "pairing");

    try { await fs.access(pairingDir); }
    catch { console.log(chalk.red("❌ No pairing directory found.")); return; }

    const files = await fs.readdir(pairingDir, { withFileTypes: true });
    const paired = files
      .filter(d => d.isDirectory() && /^\d+$/.test(d.name))
      .map(d => d.name);

    if (paired.length === 0) {
      console.log(chalk.yellow("ℹ️ No paired sessions found."));
      return;
    }

    console.log(chalk.green(`✅ Found ${paired.length} session(s). Loading...`));
    const batchSize = options.batchSize || 5;
    const results = await processBatch(paired, batchSize);
    const ok = results.filter(r => r.status === "fulfilled" && typeof r.value === "string").length;
    console.log(chalk.green(`🎉 Loaded ${ok}/${paired.length} session(s) successfully.`));
  } catch (err) {
    console.error(chalk.red("❌ Auto-load error:"), err);
  } finally {
    isAutoLoadRunning = false;
  }
}

module.exports = { autoLoadPairs };
