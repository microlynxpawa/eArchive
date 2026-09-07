const path = require("path");
const { fork } = require("child_process");

/**
 * Owns the indexer child process from the API side.
 *
 * Keeps the fork, restarts it if it dies, and relays pause/resume - so the
 * rest of the application can ignore the fact that indexing happens somewhere
 * else entirely.
 */

const WORKER = path.join(__dirname, "worker.js");

// Long enough that a worker crash-looping on a poisoned file cannot spin the
// CPU, short enough that a transient failure recovers unattended.
const RESTART_DELAY_MS = 10000;
// Give up after this many restarts in a row and leave a clear log line. The
// API keeps serving; only content search stops getting fresher.
const MAX_RESTARTS = 5;

let child = null;
let restarts = 0;
let stopping = false;
let wantPaused = false;

function spawn() {
  child = fork(WORKER, [], {
    // Inherit stdio so the worker's logs land in the same pm2 log file as
    // everything else, rather than disappearing into a detached pipe.
    stdio: "inherit",
    env: {
      ...process.env,
      // Below-normal work: the API's responsiveness comes first, always.
      NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-old-space-size=512"]
        .filter(Boolean)
        .join(" "),
    },
  });

  if (wantPaused) child.send({ type: "pause" });

  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) return;

    restarts += 1;
    if (restarts > MAX_RESTARTS) {
      console.error(
        `[SearchIndex] worker exited ${MAX_RESTARTS} times; not restarting. ` +
          "Search still works; newly uploaded files will not gain content search until this is looked at."
      );
      return;
    }
    console.error(
      `[SearchIndex] worker exited (code=${code} signal=${signal}); restarting in ${RESTART_DELAY_MS / 1000}s`
    );
    setTimeout(spawn, RESTART_DELAY_MS).unref();
  });

  // A worker that has stayed up for a while is healthy; forget old crashes so
  // one bad night does not exhaust the budget weeks later.
  setTimeout(() => {
    if (child) restarts = 0;
  }, 5 * 60 * 1000).unref();
}

function startIndexerProcess() {
  if (child) return;
  // An operator may not want indexing running at all on a given box.
  if (process.env.SEARCH_INDEXING_ENABLED === "false") {
    console.log("[SearchIndex] disabled by SEARCH_INDEXING_ENABLED=false");
    return;
  }
  stopping = false;
  spawn();
  console.log("[SearchIndex] indexer process started");
}

/** Told to the worker so extraction does not compete with the 02:00 backup. */
function pauseIndexing() {
  wantPaused = true;
  if (child) child.send({ type: "pause" });
}

function resumeIndexing() {
  wantPaused = false;
  if (child) child.send({ type: "resume" });
}

function stopIndexerProcess() {
  stopping = true;
  if (child) {
    child.send({ type: "stop" });
    child = null;
  }
}

module.exports = {
  startIndexerProcess,
  stopIndexerProcess,
  pauseIndexing,
  resumeIndexing,
};
