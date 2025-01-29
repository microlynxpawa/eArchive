const sequelize = require("../dbConnect");
const { Model, DataTypes } = require("sequelize");
const User = require("./user");

const authorizations = sequelize.define(
  "authorizations",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: User, key: "id" },
      onDelete: "CASCADE", // Automatically delete related rows
    },
    canViewOwnFiles: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    canViewDepartmentFiles: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    canViewBranchFiles: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    scanning: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    archiving: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    supervision_right: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    email_notification: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    view_upload: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    can_delete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_disabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { timestamps: true }
);

authorizations.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" }); // Defines the relationship with cascade delete

module.exports = authorizations;
