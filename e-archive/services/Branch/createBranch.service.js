const Branch = require("../../model/branch");
const handleAddDepartment = require("./addDpartment.service")
const ArchiveCategory = require("../../model/archiveCategory")
const { slugify, updateBranchDirectory } = require('../../util/directory')

const createOrUpdateBranch = async (data) => {
  const {
    name,
    person,
    address,
    email,
    phone,
    reg,
    departmentName,
    btnAction,
    updateRecord,
  } = data;

  const slug = slugify(name);

  if (btnAction === "Create") {
    // Check if a branch with the same email already exists
    const existingBranch = await Branch.findOne({ where: { email } });
    if (existingBranch) {
      return { message: "Email already in use. Please use a different email.", statusCode: 400 };
    }

    // Create a new branch
    const branch = await Branch.create({
      slug,
      name,
      contact_person: person,
      address,
      email,
      phone_number: phone,
      reg_number: reg,
      created_by: " ",
    });

    // createBranchDirectory(slug);
    const department = await ArchiveCategory.findOne({ where: { name: departmentName } });
    if (!department) {
      return { message: "Department not found", statusCode: 404 };
    }
    const departmentId = department.id;
    const branchId = branch.id;

    await handleAddDepartment({
      branchName: name,
      departmentName,
      branchId,
      departmentId,
    });

    return { message: "Branch created successfully", statusCode: 200 };
  } else {
    // Update an existing branch
    const isFound = await Branch.findOne({ where: { id: updateRecord } });
    if (!isFound) {
      return { message: "Record not found", statusCode: 404 };
    }

    await Branch.update(
      {
        slug,
        name,
        contact_person: person,
        address,
        email,
        phone_number: phone,
        reg_number: reg,
        departmentName: departmentName,
        created_by: " ",
      },
      { where: { id: updateRecord } }
    );

    updateBranchDirectory(isFound.dataValues.slug, slug);

    const department = await ArchiveCategory.findOne({ where: { name: departmentName } });
    if (!department) {
      return { message: "Department not found", statusCode: 404 };
    }
    const departmentId = department.id;
    const branchId = updateRecord;

    await handleAddDepartment({
      branchName: name,
      departmentName,
      branchId,
      departmentId,
    });

    return { message: "Branch updated", statusCode: 200 };
  }
};

module.exports =  createOrUpdateBranch;
