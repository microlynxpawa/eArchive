const sequelize = require("../dbConnect");
const { Model, DataTypes } = require("sequelize");
const User = require("./user");

const AuditLog = sequelize.define(
  "AuditLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      references: { model: User, key: "id" },
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    loginTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    logoutTime: {
      type: DataTypes.DATE,
      allowNull: true, // Nullable because the user may not have logged out yet
    },
    uploaded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    viewed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    department: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    branch: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  { timestamps: true }
);

AuditLog.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
User.hasMany(AuditLog, { foreignKey: "userId" });

module.exports = AuditLog;
