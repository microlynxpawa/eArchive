const User = require("./user");
const Branch = require("./branch");
const ArchiveCategory = require("./archiveCategory");
const AuditLog = require("./auditLogs");
const Authorizations = require("./authorizations");
const BranchDepartment = require("./branch-department");
const File = require("./file");

const defineAssociations = () => {
  // User and Branch
  User.belongsTo(Branch, { foreignKey: "branchId" });
  Branch.hasMany(User, { foreignKey: "branchId" });

  // User and ArchiveCategory
  User.belongsTo(ArchiveCategory, { foreignKey: "userGroupId" });
  ArchiveCategory.hasMany(User, { foreignKey: "userGroupId" });

  // AuditLog and User
  AuditLog.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
  User.hasMany(AuditLog, { foreignKey: "userId" });

  // Authorizations and User
  Authorizations.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });

  // BranchDepartment and Branch
  Branch.hasMany(BranchDepartment, { foreignKey: "branchId" });
  BranchDepartment.belongsTo(Branch, { foreignKey: "branchId" });

  // BranchDepartment and ArchiveCategory
  ArchiveCategory.hasMany(BranchDepartment, { foreignKey: "departmentId" });
  BranchDepartment.belongsTo(ArchiveCategory, { foreignKey: "departmentId" });

  // File and User
  File.belongsTo(User, { foreignKey: "userId", onDelete: "CASCADE" });
  User.hasMany(File, { foreignKey: "userId" });
};

module.exports = defineAssociations;