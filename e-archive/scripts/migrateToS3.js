/**
 * migrateToS3.js
 *
 * One-time script to copy all local files to the active S3 bucket.
 * Run AFTER switching the storage provider to S3 via the admin panel.
 *
 * Usage:
 *   node e-archive/scripts/migrateToS3.js
 *
 * This script does NOT delete local files — it only copies them to S3.
 * Verify all files are accessible in S3 before removing local copies.
 */

const path = require("path");
const fs = require("fs");

// Load env from the parent e-archive directory
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Bootstrap Sequelize models
const sequelize = require("../dbConnect");
require("../model/user");
require("../model/branch");
require("../model/archiveCategory");
require("../model/file");
require("../model/systemSettings");
require("../model/associations")();

const File = require("../model/file");
const s3Provider = require("../storage/providers/s3Provider");
const { toCloudKey } = require("../util/directory");

const FOLDER = (process.env.FOLDER || "").replace(/"/g, "");

async function run() {
  await sequelize.authenticate();
  console.log("[migrateToS3] DB connected.");

  const files = await File.findAll();
  console.log(`[migrateToS3] Found ${files.length} file records.`);

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const record of files) {
    const cloudKey = toCloudKey(record.filePath) + record.fileName;
    const localPath = path.join(FOLDER, cloudKey);

    if (!fs.existsSync(localPath)) {
      console.warn(`[migrateToS3] Local file not found, skipping: ${localPath}`);
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      await s3Provider.upload(buffer, cloudKey);
      console.log(`[migrateToS3] ✓ ${cloudKey}`);
      success++;
    } catch (err) {
      console.error(`[migrateToS3] ✗ ${cloudKey}: ${err.message}`);
      failed++;
    }
  }

  console.log("\n[migrateToS3] Migration complete.");
  console.log(`  Uploaded: ${success}`);
  console.log(`  Skipped (not found locally): ${skipped}`);
  console.log(`  Failed: ${failed}`);

  await sequelize.close();
}

run().catch((err) => {
  console.error("[migrateToS3] Fatal error:", err);
  process.exit(1);
});
