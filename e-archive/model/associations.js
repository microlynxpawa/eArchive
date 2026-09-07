const User = require("./user");
const Branch = require("./branch");
const ArchiveCategory = require("./archiveCategory");
const AuditLog = require("./auditLogs");
const Authorizations = require("./authorizations");
const BranchDepartment = require("./branch-department");
const File = require("./file");
const FileSendingHistory = require("./fileSendingHistory");
const FileIndexState = require("./fileIndexState");
const FileTextChunk = require("./fileTextChunk");

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

  // FileSendingHistory and User
  FileSendingHistory.belongsTo(User, { as: 'sender', foreignKey: 'senderId', onDelete: 'CASCADE' });
  FileSendingHistory.belongsTo(User, { as: 'receiver', foreignKey: 'receiverId', onDelete: 'SET NULL' });
  User.hasMany(FileSendingHistory, { as: 'sentFiles', foreignKey: 'senderId' });
  User.hasMany(FileSendingHistory, { as: 'receivedFiles', foreignKey: 'receiverId' });

  // Search index and File. CASCADE matters for confidentiality: deleting a file
  // must also remove its extracted text, or the document stays findable by its
  // contents after it is gone.
  FileIndexState.belongsTo(File, { foreignKey: 'fileId', onDelete: 'CASCADE' });
  File.hasOne(FileIndexState, { foreignKey: 'fileId' });

  FileTextChunk.belongsTo(File, { foreignKey: 'fileId', onDelete: 'CASCADE' });
  File.hasMany(FileTextChunk, { foreignKey: 'fileId' });
};

module.exports = defineAssociations;