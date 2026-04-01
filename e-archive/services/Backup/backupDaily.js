// backupDaily.js
// Daily backup script for e-archive: backs up MySQL database and FOLDER directory to DB_DAILY_BCP/date_folder

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const envPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: envPath });

const DB_NAME = process.env.DBNAME;
const DB_USER = process.env.DBUSER;
const DB_PASS = process.env.DBPASS;
const FOLDER = process.env.FOLDER.replace(/"/g, '');
const BACKUP_ROOT = process.env.DB_DAILY_BCP.replace(/"/g, '');

function getTodayFolder() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return path.join(BACKUP_ROOT, `${yyyy}-${mm}-${dd}`);
}

function backupDatabase(destFolder) {
  return new Promise((resolve, reject) => {
    const sqlFile = path.join(destFolder, `${DB_NAME}.sql`);
    const cmd = `mysqldump -u${DB_USER} -p${DB_PASS} ${DB_NAME} > "${sqlFile}"`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) return reject(stderr || err);
      resolve(sqlFile);
    });
  });
}

function copyFolder(src, dest, depth = 0) {
  if (!fs.existsSync(src)) {
    console.error(`[Backup] Source folder does not exist: ${src}`);
    return;
  }
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFolder(srcPath, destPath, depth + 1);
    } else {
      try {
        fs.copyFileSync(srcPath, destPath);
      } catch (err) {
        if (err.code === 'ENOSPC') {
          const diskFullErr = new Error('Backup destination disk is full — backup aborted.');
          diskFullErr.code = 'ENOSPC';
          throw diskFullErr;
        }
        console.error(`[Backup] Failed to copy file: ${srcPath} -> ${destPath}`, err.message);
      }
    }
  }
}

async function runBackup() {
  const todayFolder = getTodayFolder();
  if (!fs.existsSync(todayFolder)) fs.mkdirSync(todayFolder, { recursive: true });
  try {
    await backupDatabase(todayFolder);
    const folderCopyDest = path.join(todayFolder, path.basename(FOLDER));
    if (!FOLDER || FOLDER.trim() === '') {
      console.error('[Backup] FOLDER environment variable is empty or undefined!');
    } else {
      copyFolder(FOLDER, folderCopyDest);
    }
  } catch (e) {
    if (e.code === 'ENOSPC') {
      console.error('[Backup] Backup aborted: destination disk is full. Free up space on C: drive.');
    } else {
      console.error('[Backup] Backup failed:', e);
    }
  }
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup };
