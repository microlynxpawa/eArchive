const sequelize = require("../dbConnect");
const { Model, DataTypes } = require("sequelize");

const Authenticate = sequelize.define("authentication", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING },
  password: { type: DataTypes.STRING, allowNull: false },
  is_disabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  company: { type: DataTypes.STRING, unique: true, allowNull: false },
  created_by: { type: DataTypes.STRING, allowNull: false },
  created_on: { type: DataTypes.DATE },
  email: { type: DataTypes.STRING, unique: true },
  secondaryEmail: { type: DataTypes.STRING, unique: true },
});

Authenticate.sync();

module.exports = Authenticate;
