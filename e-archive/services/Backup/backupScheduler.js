// backupScheduler.js
// Scheduler for daily backup using node-cron, runs backupDaily.js logic directly for full logging

const cron = require('node-cron');
const { runBackup } = require('./backupDaily.js');

// Called from app.js once the HTTP server is listening. Registering the cron job
// is cheap; no backup runs on startup or restart — the 2:00 AM job owns it.
function startScheduler() {
  // Schedule to run every 24 hours (every day at 2:00 AM)
  cron.schedule('0 2 * * *', () => {
    runBackup().catch((err) => console.error('[Backup] Scheduled backup failed:', err));
  });

  console.log('Daily backup scheduler started. Next backup at 02:00.');
}

module.exports = { startScheduler };
