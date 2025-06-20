const sequelize = require("../dbConnect");
const { Model, DataTypes } = require("sequelize");

const Branch = sequelize.define(
  "branches",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    slug: { type: DataTypes.STRING, unique: 'slug' },
    name: { type: DataTypes.STRING, unique: 'name' },
    contact_person: { type: DataTypes.STRING },
    address: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING},
    phone_number: { type: DataTypes.STRING },
    reg_number: { type: DataTypes.STRING },
    created_by: { type: DataTypes.STRING },
  },
  { timestamps: true }
);

module.exports = Branch;
