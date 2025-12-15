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
      defaultValue: false,
    },
    archiving: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    supervision_right: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    email_notification: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    view_upload: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_disabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  { timestamps: true }
);

// authorizations.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });

// Hook to update columns when is_admin is set to true
authorizations.addHook("beforeUpdate", (authorization, options) => {
  if (authorization.is_admin === true) {
    authorization.canViewOwnFiles = true;
    authorization.canViewDepartmentFiles = true;
    authorization.canViewBranchFiles = true;
    authorization.scanning = true;
    authorization.archiving = true;
    authorization.supervision_right = true;
    authorization.email_notification = true;
    authorization.view_upload = true;
  }
});

// Hook for beforeCreate, in case the is_admin value is set during creation
authorizations.addHook("beforeCreate", (authorization, options) => {
  if (authorization.is_admin === true) {
    authorization.canViewOwnFiles = true;
    authorization.canViewDepartmentFiles = true;
    authorization.canViewBranchFiles = true;
    authorization.scanning = true;
    authorization.archiving = true;
    authorization.supervision_right = true;
    authorization.email_notification = true;
    authorization.view_upload = true;
  }
});

module.exports = authorizations;
