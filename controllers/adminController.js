const ArchiveCategory = require("../model/archiveCategory");
const branch = require("../model/branch");
const User = require("../model/user");
const AuditLog = require("../model/auditLogs")

const DEFAULT_PATH = process.env.FOLDER || "C:\\e-archiveUploads";

const {
  askQuestion,
  updateLogoutTime,
} = require("../util/directory");

const createOrUpdateUserGroup = require("../services/UserGroup/createUserGroup.service");
const removeUserGroupLogic = require("../services/UserGroup/removeGroup.service");
const createOrUpdateBranch = require("../services/Branch/createBranch.service");
const removeBranchLogic = require("../services/Branch/removeBranch.service");
const createOrUpdateUser = require("../services/User/createUser.service");
const deleteUserById = require("../services/User/removeUser.service");
const authenticateUser = require("../services/Auth/signIn.service");
const updateUserPassword = require("../services/Auth/updatePassword.service");
const buildFolderStructure = require("../services/Display/fileDisplay.service");
const storeProfilePicture = require("../services/Profile/profilePicture.service");
const uploadFileLogic = require("../services/Upload/fileUpload.service");
const getFileContentLogic = require("../services/Display/fileContent.service");
const fetchAuditLogsForUser = require("../services/AuditLog/auditLog.service");
const getUserByUsername = require("../services/AccessControl/getUser.service");
const updateUserPermissions = require("../services/AccessControl/accessControl.service");
const fetchUsersByQuery = require("../services/Share/getMultipleUsers.service");
const fetchUsersByEmail = require("../services/Share/fetchUsersViaEmails.service");
const sendFilesToUsers = require("../services/Share/sendFiles.service");
const sendFilesViaEmail = require("../services/Share/sendViaEmal.service");
const getDepartmentByName = require("../services/AccessControl/getDepartment");
const updateDepartmentPermissions = require("../services/AccessControl/departmentAccessControl");
const deleteFiles = require("../services/Delete/deleteFile.service");

const DashboardLayout = "dashboard/master";


// Get Routes
const login = (req, res) => {
  res.render("auth/master", { layout: "auth/master" });
};

const dashboard = async (req, res) => {
  const userSession = req.session.user;
  const user = await User.findOne({
    where: { id: userSession },
    include: [
      {
        model: branch,
        attributes: ["name", "id"],
      },
      {
        model: AuditLog,
        attributes: ["loginTime", "logoutTime"],
        order: [["logoutTime", "DESC"]], 
        limit: 1,
      },
    ],
  });
  res.render("dashboard/pages/index", { layout: DashboardLayout, user });
};

const client = (req, res) => {
  res.render("dashboard/pages/client", { layout: DashboardLayout });
};

const userGroup = (req, res) => {
  res.render("dashboard/pages/user-group", { layout: DashboardLayout });
};

const editProfile = async (req, res) => {
  const userSession = req.session.user;
  const user = await User.findOne({
    where: { id: userSession },
    include: [
      {
        model: branch,
        attributes: ["name", "id"],
      },
    ],
  });
  res.render("dashboard/pages/edit-profile", { layout: DashboardLayout, user });
};

const userFileUpload = async (req, res) => {
  res.render("dashboard/pages/file-upload", { layout: DashboardLayout });
};

const retrieveUserGroup = async (req, res) => {
  // retrieve records
  const records = await ArchiveCategory.findAll();
  res.json({ message: "records", statusCode: 200, records });
};

const branches = async (req, res) => {
  res.render("dashboard/pages/branches", { layout: DashboardLayout });
};

const userManagement = async (req, res) => {
  res.render("dashboard/pages/user-mgt", { layout: DashboardLayout });
};

const retrieveUsers = async (req, res) => {
  try {
    const records = await User.findAll({
      include: [
        {
          model: branch,
          attributes: ["name", "id"],
        },
        {
          model: ArchiveCategory,
          attributes: ["name", "id"],
        },
      ],
    });

    res.json({ message: "records", statusCode: 200, records });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred", statusCode: 500 });
  }
};

const auditLog = async (req, res) => {
  try {
    const userId = req.session.user;

    const logs = await fetchAuditLogsForUser(userId);

    res.render("dashboard/pages/auditLogs", { logs, layout: DashboardLayout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const GetUser = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await getUserByUsername(username);
    res.json(user);
  } catch (error) {
    console.error(error.message);
    res.status(error.message === "User not found." ? 404 : 500).json({ message: error.message });
  }
};

const getPickSend = async (req,res)=>{
  res.redirect('see-file')
};

const getUsers = async (req, res) => {
  try {
    const query = req.query.q;
    const users = await fetchUsersByQuery(query);
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ error: error.message || "Internal server error." });
  }
};

const retrieveBranches = async (req, res) => {
  // retrieve records
  const records = await branch.findAll();
  res.json({ message: "records", statusCode: 200, records });
};

const getDepartment = async (req, res) => {
  
  const { departmentName } = req.params;

  try {
    const department = await getDepartmentByName(departmentName);
    res.json(department);
  } catch (error) {
    console.error(error.message);
    res.status(error.message === "Department not found." ? 404 : 500).json({ message: error.message });
  }
};

const getUsersByEmail = async (req, res) => {
  try {
    const query = req.query.q;
    const users = await fetchUsersByEmail(query);
    res.json(users);
  } catch (error) {
    console.error("Error fetching users by email:", error.message);
    res.status(500).json({ error: error.message || "Internal server error." });
  }
};


// Post Routes

const createUserGroup = async (req, res) => {
  try {
    const response = await createOrUpdateUserGroup(req.body);
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message, statusCode: 500 });
  }
};

const removeUserGroup = async (req, res) => {
  try {
    const { deleteRecord } = req.body;

    const message = await removeUserGroupLogic(deleteRecord);

    return res.json({ message, statusCode: 200 });
  } catch (error) {
    console.error("Error deleting record:", error);
    return res.status(404).json({ message: error.message, statusCode: 404 });
  }
};

const createBranch = async (req, res) => {
  try {
    const response = await createOrUpdateBranch(req.body);
    res.json(response);
  } catch (error) {
    console.error("Error in createBranch:", error);
    res.json({ message: "Unable to create branch", statusCode: 404 });
  }
};

const removeBranch = async (req, res) => {
  const { deleteRecord } = req.body;
  try {
    const resultMessage = await removeBranchLogic(deleteRecord);
    return res.json({ message: resultMessage, statusCode: 200 });
  } catch (error) {
    console.error("Error:", error.message);
    return res.json({ message: error.message, statusCode: 404 });
  }
};

const createUserManagement = async (req, res) => {
  try {
    const {
      fullname,
      branchId,
      userGroup,
      email,
      pEmail,
      password,
      permissions,
      username,
      btnAction,
      updateRecord,
    } = req.body;

    // Call the service function
    const result = await createOrUpdateUser({
      fullname,
      branchId,
      userGroup,
      email,
      pEmail,
      password,
      permissions,
      username,
      btnAction,
      updateRecord,
    });

    res.json({ message: result.message });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ message: error.message || "Internal server error." });
  }
};

const removeUser = async (req, res) => {
  try {
    const { deleteRecord } = req.body;
    const result = await deleteUserById(deleteRecord);
    res.json(result);
  } catch (error) {
    console.error("Error removing user:", error.message);
    res.status(400).json({ message: error.message, statusCode: 400 });
  }
};

const signIn = async (req, res) => {
  const { user, password } = req.body;

  try {
    const { userId, route } = await authenticateUser(user, password);
    req.session.user = userId;

    res.json({
      message: "Login successfully",
      statusCode: 200,
      route,
    });
  } catch (error) {
    console.error(error);
    res.json({
      message: error.message || "Unable to process request",
      statusCode: error.message === "Invalid credentials" ? 404 : 400,
    });
  }
};

const updatePassword = async (req, res) => {
  const userSession = req.session.user;
  const { oldPass, newPass } = req.body;

  try {
    const result = await updateUserPassword(userSession, oldPass, newPass);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const destroyUserSession = async (req, res) => {
  const userId = req.session.user;
  updateLogoutTime(userId);
  req.session.user = null;
  res.redirect("/");
};

const uploadFile = async (req, res) => {
  try {
    const file = req.file;
    const fileName = req.body.fileName;
    const userId = req.session.user;

    const result = await uploadFileLogic(file, fileName, userId, askQuestion);

    return res.json(result);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: error.message });
  }
};

const seeFile = async (req, res) => {
  try {
    const userId = req.session.user;
    const fileStructure = await buildFolderStructure( DEFAULT_PATH || "C:\\e-archiveUploads", userId);
    res.render("dashboard/pages/gallery", { fileStructure, layout: DashboardLayout });
  } catch (error) {
    console.error("Error fetching file structure:", error);
    res.status(500).send("Internal Server Error");
  }
};

const fileContent = async (req, res) => {
  const { fileName } = req.query;

  try {
    const { fullPath, mimeType } = await getFileContentLogic(fileName);

    // Serve the file as binary data
    res.contentType(mimeType);
    res.sendFile(fullPath);
  } catch (error) {
    console.error(error);
    res.status(error.message.includes("missing") || error.message.includes("not found") ? 404 : 500).send(error.message);
  }
};

const accessControl = async (req, res) => {
  const { username } = req.params;
  const roles = req.body;

  try {
    const message = await updateUserPermissions(username, roles);
    res.json({ message });
  } catch (error) {
    console.error("Error in access control:", error);
    res.status(500).json({ message: error.message });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    const user = req.session.user; // Assuming session contains the logged-in user's ID
    const file = req.file;

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not authenticated.' });
    }

    // Call the service function to store the profile picture
    const filePath = await storeProfilePicture(user, file);

    // Update user record in the database
    const updatedUser = await User.update(
      { profilePicturePath: filePath },
      { where: { id: user } }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully.',
      data: filePath,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const sendFiles = async (req, res) => {
  try {
    const { users, files } = req.body;

    // Call the service function
    const { missingFiles } = await sendFilesToUsers(users, files);

    if (missingFiles.length > 0) {
      return res.status(404).json({
        message: 'Some files could not be sent.',
        missingFiles,
      });
    }

    res.json({ message: 'Files sent successfully to specified users.' });
  } catch (error) {
    console.error('Error sending files:', error.message);
    res.status(500).json({ error: error.message || 'Internal server error.' });
  }
};

const sendFilesEmail = async (req, res) => {
  try {
    const { users, files } = req.body;
    const { missingFiles } = await sendFilesViaEmail(users, files);

    if (missingFiles.length > 0) {
      return res.status(404).json({
        message: "Some files could not be sent.",
        missingFiles,
      });
    }

    res.json({ message: "Files sent successfully to specified users." });
  } catch (error) {
    console.error("Error sending files:", error.message);
    res.status(500).json({ error: error.message || "Internal server error." });
  }
};

const departmentAccessControl = async (req, res) => {
  const { departmentName } = req.params;
  const roles = req.body; // Admin, supervisor, or personnel roles sent from frontend

  try {
    const message = await updateDepartmentPermissions(departmentName, roles);
    res.json({ message });
  } catch (error) {
    console.error("Error in department access control:", error);
    res.status(500).json({ message: error.message });
  }
};

const deleteFile = async (req, res) => {
  try {
    const { files } = req.body; // Expect an array of file names

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Files array is required and must not be empty.' });
    }

    const { deletedFiles, missingFiles, errors } = await deleteFiles(files);

    if (errors.length > 0) {
      return res.status(500).json({ error: 'Failed to delete some files.', details: errors });
    }

    if (missingFiles.length > 0) {
      return res.status(404).json({ error: 'Some files not found.', details: missingFiles });
    }

    res.json({ success: true, deletedFiles });
  } catch (err) {
    console.error('Error in /delete-file:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};


module.exports = {
  login,
  destroyUserSession,
  userFileUpload,
  updatePassword,
  editProfile,
  dashboard,
  client,
  userGroup,
  createUserGroup,
  retrieveUserGroup,
  removeUserGroup,
  branches,
  createBranch,
  retrieveBranches,
  removeBranch,
  userManagement,
  createUserManagement,
  retrieveUsers,
  removeUser,
  signIn,
  uploadFile,
  seeFile,
  fileContent,
  auditLog,
  GetUser,
  accessControl,
  uploadProfilePicture,
  getPickSend,
  getUsers,
  sendFiles,
  getUsersByEmail,
  sendFilesEmail,
  getDepartment,
  departmentAccessControl,
  deleteFile
};
