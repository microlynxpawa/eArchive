const branch = require("../../model/branch");
const { getDefaultFolders, createBranchDirectory, updateBranchDirectory, slugify } = require("../../util/directory");

const createOrUpdateBranch = async (data) => {
  const {
    name,
    person,
    address,
    email,
    phone,
    reg,
    btnAction,
    updateRecord,
  } = data;

  const slug = slugify(name);

  if (btnAction === "Create") {
    // Create a new branch
    await branch.create({
      slug,
      name,
      contact_person: person,
      address,
      email,
      phone_number: phone,
      reg_number: reg,
      created_by: " ",
    });

    const subFolders = await getDefaultFolders();
    createBranchDirectory(slug, subFolders);

    return { message: "Branch created successfully", statusCode: 200 };
  } else {
    // Update an existing branch
    const isFound = await branch.findOne({ where: { id: updateRecord } });
    if (!isFound) {
      return { message: "Record not found", statusCode: 404 };
    }

    await branch.update(
      {
        slug,
        name,
        contact_person: person,
        address,
        email,
        phone_number: phone,
        reg_number: reg,
        created_by: " ",
      },
      { where: { id: updateRecord } }
    );

    updateBranchDirectory(isFound.dataValues.slug, slug);

    return { message: "Branch updated", statusCode: 200 };
  }
};

module.exports =  createOrUpdateBranch;
