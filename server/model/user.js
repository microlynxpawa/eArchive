const sequelize = require("../dbConnect");
const { Model, DataTypes } = require("sequelize");
const Branch = require("./branch");
const ArchiveCategory = require("./archiveCategory");

const User = sequelize.define(
  "users",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    username: { type: DataTypes.STRING, unique: "username", allowNull: false },
    fullname: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, unique: "email", allowNull: false },
    private_email: {
      type: DataTypes.STRING,
      unique: "private_email",
      allowNull: false,
    },
    password: { type: DataTypes.STRING, allowNull: false },
    permissions: { type: DataTypes.STRING },
    branchId: {
      type: DataTypes.INTEGER,
      references: { model: Branch, key: "id" },
      allowNull: false,
    },  
    userGroupId: {
      type: DataTypes.INTEGER,
      references: { model: ArchiveCategory, key: "id" },
      allowNull: false
    },
    folderPath: { type: DataTypes.STRING },
    profilePicturePath: { type: DataTypes.STRING },
  },
  { timestamps: true }
);

module.exports = User;