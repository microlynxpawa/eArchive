// backupScheduler.js
// Scheduler for daily backup using node-cron, runs backupDaily.js logic directly for full logging

const cron = require('node-cron');
const { runBackup } = require('./backupDaily.js');
const { pauseIndexing, resumeIndexing } = require('../Search/indexer/indexerHost.js');

// Called from app.js once the HTTP server is listening. Registering the cron job
// is cheap; no backup runs on startup or restart — the 2:00 AM job owns it.
function startScheduler() {
  // Schedule to run every 24 hours (every day at 2:00 AM)
  cron.schedule('0 2 * * *', async () => {
    // Indexing reads whole files off the same disk the backup is copying, so
    // the two are kept apart. Resume in a finally: a failed backup must not
    // leave indexing switched off until the next restart.
    pauseIndexing();
    try {
      await runBackup();
    } catch (err) {
      console.error('[Backup] Scheduled backup failed:', err);
    } finally {
      resumeIndexing();
    }
  });

  console.log('Daily backup scheduler started. Next backup at 02:00.');
}

module.exports = { startScheduler };
