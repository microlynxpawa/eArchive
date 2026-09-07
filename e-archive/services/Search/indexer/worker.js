/**
 * The indexer's child-process entry point.
 *
 * This runs in its own process, forked by indexerHost. That isolation is the
 * point: extraction reads whole files into memory and, once OCR is installed,
 * runs a WASM engine over them. A crash or a stall there must not be able to
 * take down the API the whole institution is using.
 *
 * Not meant to be run by hand - start the server, or use the backfill script
 * to queue work.
 */
require("dotenv").config();

const sequelize = require("../../../dbConnect");
const defineAssociations = require("../../../model/associations");
const { startIndexer, stopIndexer, pause, resume } = require("./indexRunner");

// The parent speaks to us over IPC. Only two things are ever said.
process.on("message", (msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "pause") {
    pause();
    console.log("[SearchIndex] paused");
  } else if (msg.type === "resume") {
    resume();
    console.log("[SearchIndex] resumed");
  } else if (msg.type === "stop") {
    stopIndexer();
    // Tesseract workers are separate OS processes of their own; without this
    // they outlive us and leak on every restart.
    const { shutdownOcr } = require("../extract/ocr");
    shutdownOcr()
      .catch(() => {})
      .then(() => sequelize.close())
      .finally(() => process.exit(0));
  }
});

async function main() {
  await sequelize.authenticate();
  defineAssociations();
  startIndexer();
}

main().catch((err) => {
  console.error("[SearchIndex] worker failed to start:", err.message);
  process.exit(1);
});

// A worker that dies quietly would leave the archive silently un-indexed, so
// say so loudly; the host restarts us.
process.on("uncaughtException", (err) => {
  console.error("[SearchIndex] uncaught:", err.stack || err.message);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("[SearchIndex] unhandled rejection:", (err && err.stack) || err);
  process.exit(1);
});
