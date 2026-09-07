/**
 * Enqueues the existing archive for indexing.
 *
 * Paging is by keyset (id > cursor), not OFFSET, for two reasons: it stays
 * fast at the far end of a large table, and the cursor is derived from the
 * data rather than held in memory, so a killed run resumes from where it
 * stopped simply by being run again.
 *
 * Enqueueing only writes queue rows - the actual reading of files is done by
 * the worker, at its own pace, so this finishes in seconds even for a large
 * archive.
 *
 *   node scripts/backfillSearchIndex.js               queue anything unqueued
 *   node scripts/backfillSearchIndex.js --retry-failed  also retry failures
 *   node scripts/backfillSearchIndex.js --force       re-index everything
 *   node scripts/backfillSearchIndex.js --status      just report
 */
require("dotenv").config();

const sequelize = require("../dbConnect");
const File = require("../model/file");
const FileIndexState = require("../model/fileIndexState");
const defineAssociations = require("../model/associations");
const { enqueueForIndex, getIndexStats, INDEXER_VERSION } = require("../services/Search/indexer/queue.service");

const BATCH = 500;

async function report() {
  const stats = await getIndexStats();
  console.log(`  files in archive : ${stats.totalFiles}`);
  console.log(`  never queued     : ${stats.untracked}`);
  console.log(`  pending          : ${stats.byStatus.pending}`);
  console.log(`  running          : ${stats.byStatus.running}`);
  console.log(`  done             : ${stats.byStatus.done}`);
  console.log(`  skipped          : ${stats.byStatus.skipped}`);
  console.log(`  failed           : ${stats.byStatus.failed}`);
  console.log(`  coverage         : ${(stats.coverage * 100).toFixed(1)}%`);
}

async function run() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const retryFailed = args.includes("--retry-failed");

  await sequelize.authenticate();
  defineAssociations();

  if (args.includes("--status")) return report();

  console.log("before:");
  await report();
  console.log("");

  let cursor = 0;
  let seen = 0;
  let queued = 0;

  for (;;) {
    const files = await File.findAll({
      attributes: ["id"],
      where: sequelize.where(sequelize.col("Files.id"), ">", cursor),
      order: [["id", "ASC"]],
      limit: BATCH,
      raw: true,
    });
    if (files.length === 0) break;

    for (const file of files) {
      cursor = file.id;
      seen += 1;

      if (!force) {
        const state = await FileIndexState.findOne({
          where: { fileId: file.id },
          attributes: ["id", "status", "indexerVersion"],
        });
        // Already handled by a current-version indexer, and not a failure we
        // were asked to retry.
        if (state) {
          const stale = state.indexerVersion !== INDEXER_VERSION;
          const isFailure = state.status === "failed";
          if (!stale && !(isFailure && retryFailed)) continue;
        }
      }

      const outcome = await enqueueForIndex(file.id, { priority: 0, force });
      if (outcome !== "skipped") queued += 1;
    }

    process.stdout.write(`\r  scanned ${seen}, queued ${queued} ...`);
  }

  console.log(`\r  scanned ${seen}, queued ${queued}      `);
  console.log("\nafter:");
  await report();
  console.log("\nThe worker drains the queue in the background. Re-run with");
  console.log("--status at any time to watch progress.");
}

run()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("backfill failed:", err.message);
    await sequelize.close();
    process.exit(1);
  });
