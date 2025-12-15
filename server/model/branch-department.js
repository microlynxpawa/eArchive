const sequelize = require("../dbConnect");
const { DataTypes } = require("sequelize");
const Branch = require("./branch");
const ArchiveCategory = require("./archiveCategory");

const BranchDepartment = sequelize.define(
  "branch_department",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    branchId: {
      type: DataTypes.INTEGER,
      references: { model: Branch, key: "id" },
      allowNull: false,
    },
    departmentId: {
      type: DataTypes.INTEGER,
      references: { model: ArchiveCategory, key: "id" },
      allowNull: false,
    },
    branchName: { type: DataTypes.STRING, allowNull: false },
    departmentName: { type: DataTypes.STRING, allowNull: false },
    departmentFolderPath: {type: DataTypes.STRING, allowNull: false},
  },
  { timestamps: true }
);

// Define associations
// Branch.hasMany(BranchDepartment, { foreignKey: "branchId" });
// BranchDepartment.belongsTo(Branch, { foreignKey: "branchId" });

// ArchiveCategory.hasMany(BranchDepartment, { foreignKey: "departmentId" });
// BranchDepartment.belongsTo(ArchiveCategory, { foreignKey: "departmentId" });

module.exports = BranchDepartment;
