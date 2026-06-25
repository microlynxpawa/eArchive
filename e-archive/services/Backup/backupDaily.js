// backupDaily.js
// Daily backup: backs up MySQL database and (local mode only) FOLDER directory.

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const envPath = path.resolve(__dirname, "../../.env");
require("dotenv").config({ path: envPath });

const DB_NAME = process.env.DBNAME;
const DB_USER = process.env.DBUSER;
const DB_PASS = process.env.DBPASS;
const FOLDER = (process.env.FOLDER || "").replace(/"/g, "");
const BACKUP_ROOT = (process.env.DB_DAILY_BCP || "").replace(/"/g, "");

function getTodayFolder() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
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
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
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
        if (err.code === "ENOSPC") {
          const e = new Error("Backup destination disk is full — backup aborted.");
          e.code = "ENOSPC";
          throw e;
        }
        console.error(`[Backup] Failed to copy: ${srcPath}`, err.message);
      }
    }
  }
}

async function getProviderType() {
  try {
    const { getProvider } = require("../../storage/storageProvider");
    const provider = await getProvider();
    return provider.type;
  } catch {
    return "local";
  }
}

async function runBackup() {
  if (!BACKUP_ROOT) {
    console.error("[Backup] DB_DAILY_BCP is not set — skipping backup.");
    return;
  }
  const todayFolder = getTodayFolder();
  if (!fs.existsSync(todayFolder)) fs.mkdirSync(todayFolder, { recursive: true });

  try {
    await backupDatabase(todayFolder);

    const providerType = await getProviderType();
    if (providerType === "local") {
      if (!FOLDER || FOLDER.trim() === "") {
        console.error("[Backup] FOLDER env var is empty — skipping file backup.");
      } else {
        const folderCopyDest = path.join(todayFolder, path.basename(FOLDER));
        copyFolder(FOLDER, folderCopyDest);
      }
    } else {
      console.log(
        "[Backup] S3 storage is active — file backup skipped (managed by S3)."
      );
    }
  } catch (e) {
    if (e.code === "ENOSPC") {
      console.error("[Backup] Aborted: destination disk is full.");
    } else {
      console.error("[Backup] Backup failed:", e);
    }
  }
}

if (require.main === module) {
  runBackup();
}

module.exports = { runBackup };
