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
Branch.hasMany(BranchDepartment, { foreignKey: "branchId" });
BranchDepartment.belongsTo(Branch, { foreignKey: "branchId" });

ArchiveCategory.hasMany(BranchDepartment, { foreignKey: "departmentId" });
BranchDepartment.belongsTo(ArchiveCategory, { foreignKey: "departmentId" });

// async function populateBranchDepartment() {
//   try {
//     // Check if the BranchDepartment table is already populated
//     const branchDepartmentCount = await BranchDepartment.count();
//     if (branchDepartmentCount > 0) {
//       console.log("BranchDepartment table is already populated. Skipping population.");
//       return;
//     }

//     // Start a transaction
//     const transaction = await sequelize.transaction();
//     console.log("Transaction started.");

//     // Fetch all branches and departments
//     const branches = await Branch.findAll({ transaction });
//     const departments = await ArchiveCategory.findAll({ transaction });

//     // Ensure branches and departments exist
//     if (branches.length === 0 || departments.length === 0) {
//       throw new Error("Branches or Departments table is empty. Populate them first.");
//     }

//     // Loop through all combinations and insert records
//     for (const branch of branches) {
//       for (const department of departments) {
//         await BranchDepartment.findOrCreate({
//           where: { branchId: branch.id, departmentId: department.id },
//           defaults: { branchName: branch.name, departmentName: department.name },
//           transaction,
//         });
//       }
//     }

//     await transaction.commit();
//     console.log("BranchDepartment table populated successfully!");
//   } catch (error) {
//     console.error("Error populating BranchDepartment table:", error);
//     if (error.transaction) {
//       await error.transaction.rollback();
//       console.log("Transaction rolled back.");
//     }
//   }
// }

// // Call the function when the server starts
// populateBranchDepartment();

module.exports = BranchDepartment;
