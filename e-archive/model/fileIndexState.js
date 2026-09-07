const sequelize = require("../dbConnect");
const { DataTypes } = require("sequelize");
const File = require("./file");

/**
 * One row per file: what the indexer has extracted, and what it still owes.
 *
 * This doubles as the job queue. Keeping the status and the queue position in
 * a single row means a file can never be "done" and "queued" at the same time.
 */
const FileIndexState = sequelize.define(
  "file_index_state",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fileId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: File, key: "id" },
    },
    // pending -> running -> done | failed | skipped
    status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "pending" },
    // Higher runs first. Fresh uploads use 100 so they jump the backfill.
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // pdf-text | plain-text | ocr | none
    engine: { type: DataTypes.STRING(16), allowNull: true },
    pageCount: { type: DataTypes.INTEGER, allowNull: true },
    charCount: { type: DataTypes.INTEGER, allowNull: true },
    ocrConfidence: { type: DataTypes.FLOAT, allowNull: true },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastError: { type: DataTypes.TEXT, allowNull: true },
    nextAttemptAt: { type: DataTypes.DATE, allowNull: true },
    lockedBy: { type: DataTypes.STRING(64), allowNull: true },
    lockedAt: { type: DataTypes.DATE, allowNull: true },
    extractedAt: { type: DataTypes.DATE, allowNull: true },
    indexerVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  },
  { timestamps: true, freezeTableName: true }
);

module.exports = FileIndexState;
