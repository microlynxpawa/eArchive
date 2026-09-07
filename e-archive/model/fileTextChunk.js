const sequelize = require("../dbConnect");
const { DataTypes } = require("sequelize");
const File = require("./file");

/**
 * One row per page of extracted text.
 *
 * Storing per page rather than per file is what lets a search result say which
 * page a phrase was found on, and keeps a single row well inside MEDIUMTEXT
 * for even a long document.
 *
 * The FULLTEXT index on `content` is created by the migration, not here:
 * Sequelize cannot express one.
 */
const FileTextChunk = sequelize.define(
  "file_text_chunks",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fileId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: File, key: "id" },
    },
    // 1-based; 1 for single-page sources such as an image.
    page: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    content: { type: DataTypes.TEXT("medium"), allowNull: false },
  },
  { timestamps: true, freezeTableName: true }
);

module.exports = FileTextChunk;
