/**
 * Minimal migration runner.
 *
 * sequelize-cli is not wired up in this project (there is no .sequelizerc and
 * no config/config.json), but a `sequelizemeta` table already exists and
 * records the migrations that have run. This runner uses that same table and
 * the same migration file shape, so nothing has to be re-learned and the CLI
 * can still be adopted later without a rewrite.
 *
 *   node scripts/runMigrations.js              apply every pending migration
 *   node scripts/runMigrations.js --status     list applied and pending
 *   node scripts/runMigrations.js --baseline <file>
 *                                              record a migration as applied
 *                                              without running it, for a
 *                                              database that already has its
 *                                              changes
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Sequelize } = require("sequelize");
const sequelize = require("../dbConnect");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const META_TABLE = "sequelizemeta";

async function ensureMetaTable() {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS \`${META_TABLE}\` (
       \`name\` VARCHAR(255) NOT NULL,
       PRIMARY KEY (\`name\`),
       UNIQUE KEY \`name\` (\`name\`)
     ) ENGINE=InnoDB`
  );
}

async function appliedNames() {
  const [rows] = await sequelize.query(`SELECT name FROM \`${META_TABLE}\``);
  return new Set(rows.map((r) => r.name));
}

function migrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".js"))
    .sort(); // filename order is the intended run order
}

async function markApplied(name) {
  await sequelize.query(`INSERT IGNORE INTO \`${META_TABLE}\` (name) VALUES (?)`, {
    replacements: [name],
  });
}

async function run() {
  const args = process.argv.slice(2);
  await sequelize.authenticate();
  await ensureMetaTable();

  const applied = await appliedNames();
  const files = migrationFiles();

  if (args.includes("--status")) {
    for (const file of files) {
      console.log(`  ${applied.has(file) ? "applied" : "pending"}  ${file}`);
    }
    return;
  }

  const baselineAt = args.indexOf("--baseline");
  if (baselineAt !== -1) {
    const name = args[baselineAt + 1];
    if (!name) throw new Error("--baseline needs a migration filename");
    if (!files.includes(name)) throw new Error(`no such migration: ${name}`);
    await markApplied(name);
    console.log(`baselined ${name} (recorded as applied, not run)`);
    return;
  }

  const pending = files.filter((f) => !applied.has(f));
  if (pending.length === 0) {
    console.log("no pending migrations");
    return;
  }

  for (const file of pending) {
    const migration = require(path.join(MIGRATIONS_DIR, file));
    if (typeof migration.up !== "function") {
      throw new Error(`${file} has no up()`);
    }
    console.log(`running ${file} ...`);
    // Migrations are not wrapped in a transaction: MySQL commits DDL
    // implicitly, so a wrapper would give a false sense of atomicity. Each
    // migration is written to be safe to re-run instead.
    await migration.up(sequelize.getQueryInterface(), Sequelize);
    await markApplied(file);
    console.log(`  done  ${file}`);
  }
}

run()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("migration failed:", err.message);
    await sequelize.close();
    process.exit(1);
  });
