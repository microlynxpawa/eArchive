const sequelize = require("../dbConnect");
const { Model, DataTypes } = require("sequelize");
const User = require("./user");

const File = sequelize.define(
  "Files",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      references: { model: User, key: "id" },
      allowNull: false,
    },
    fileName: { type: DataTypes.STRING },
    filePath: { type: DataTypes.STRING },
    department: { type: DataTypes.STRING },
    branchName: { type: DataTypes.STRING},
  },
  { timestamps: true }
);

// File.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE"  });
// User.hasMany(File, { foreignKey: "userId" });

module.exports = File;
