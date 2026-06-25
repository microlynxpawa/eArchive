const sequelize = require("../dbConnect");
const { DataTypes } = require("sequelize");

const SystemSettings = sequelize.define(
  "SystemSettings",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    activeProvider: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "local",
      validate: { isIn: [["local", "s3"]] },
    },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true },
  },
  { timestamps: true }
);

module.exports = SystemSettings;
