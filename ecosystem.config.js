/**
 * ecosystem.config.js  —  PM2 config (Pterodactyl & local)
 *
 * Usage:
 *   pm2 start ecosystem.config.js   # start
 *   pm2 restart gabimaru-web        # restart
 *   pm2 logs gabimaru-web           # tail logs
 *
 * On Pterodactyl set the startup command to:
 *   pm2-runtime start ecosystem.config.js
 * (pm2-runtime keeps the process in the foreground so Pterodactyl
 *  sees it as "running" and doesn't restart the container.)
 *
 * On Heroku the Procfile handles startup — PM2 is not needed there.
 */

module.exports = {
  apps: [
    {
      name:   "gabimaru-web",
      script: "site.js",
      watch:  false,

      // Memory guard
      max_memory_restart: "512M",

      // Keep alive on crash
      autorestart: true,
      max_restarts: 10,
      min_uptime:   "10s",

      // Environment
      env: {
        NODE_ENV: "production",
        // PORT is read from the host environment first (Heroku / Pterodactyl
        // inject it automatically).  Fall back to 2010 for local dev.
        PORT: process.env.PORT || 2010,
      },

      // Log files (PM2 creates the directory if missing)
      error_file:      "./logs/error.log",
      out_file:        "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",

      // Don't merge stdout/stderr — keeps them easier to grep
      merge_logs: false,
    }
  ]
};
