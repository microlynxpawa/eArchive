// backupScheduler.js
// Scheduler for daily backup using node-cron, runs backupDaily.js logic directly for full logging

const cron = require('node-cron');
const { runBackup } = require('./backupDaily.js');

// Run the first backup immediately on startup
runBackup();

// Schedule to run every 24 hours (every day at 2:00 AM)
cron.schedule('0 2 * * *', () => {
  runBackup();
});

console.log('Daily backup scheduler started. First backup running now.');
