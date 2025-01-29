const sequelize = require("../dbConnect");
const { Model, DataTypes } = require("sequelize");

const UserGroup = sequelize.define(
  "user_groups",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  },
  { timestamps: true }
);

UserGroup.sync();

module.exports = UserGroup;