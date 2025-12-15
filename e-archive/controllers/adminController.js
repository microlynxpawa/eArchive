const ArchiveCategory = require("../model/archiveCategory");
const branch = require("../model/branch");
const User = require("../model/user");
const AuditLog = require("../model/auditLogs");
const BranchDepartment = require("../model/branch-department")
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
const { authenticateUser, forgotPassword } = require("../services/Auth/signIn.service");
const updateUserPassword = require("../services/Auth/updatePassword.service");
const buildFolderStructure = require("../services/Display/fileDisplay.service");
const storeProfilePicture = require("../services/Profile/profilePicture.service");
const uploadFileLogic = require("../services/Upload/fileUpload.service");
const { uploadMultipleFiles } = require('../services/Upload/fileUploadMultiple.service');
const getFileContentLogic = require("../services/Display/fileContent.service");
const fetchAuditLogsForUser = require("../services/AuditLog/auditLog.service");
const getUserByUsername = require("../services/AccessControl/getUser.service");
const updateUserPermissions = require("../services/AccessControl/accessControl.service");
const fetchUsersByQuery = require("../services/Share/getMultipleUsers.service");
const fetchUsersByEmail = require("../services/Share/fetchUsersViaEmails.service");
const sendFilesViaEmail = require("../services/Share/sendViaEmal.service");
const sendFilesToUsers = require("../services/Share/sendFiles.service");
const getDepartmentByName = require("../services/AccessControl/getDepartment");
const deleteFiles = require("../services/Delete/deleteFile.service");
const handleDeleteDepartment = require("../services/Branch/removeDepartment.service")
const AdminActions = require("../model/adminActions"); // Import the admin-actions model

const DashboardLayout = "dashboard/master";


// Get Routes
// COMMENTED OUT: EJS rendering - React app handles login page
/*
const login = (req, res) => {
  // If authenticated (session restored by rememberMeMiddleware or normal login), set flag
  const isAuthenticated = !!(req.session && req.session.user);
  if (isAuthenticated) {
    // Optionally, redirect immediately (but the EJS flag/script will handle it too)
    // return res.redirect('/admin/dashboard');
  }
  res.render("auth/master", { layout: "auth/master", isAuthenticated });
};
*/

// COMMENTED OUT: EJS rendering - Use dashboardData endpoint instead
/*
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
*/

// COMMENTED OUT: EJS rendering - React app handles these pages
/*
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
*/

const retrieveUserGroup = async (req, res) => {
  // retrieve records
  const records = await ArchiveCategory.findAll();
  res.json({ message: "records", statusCode: 200, records });
};

// COMMENTED OUT: EJS rendering - React app handles these pages
/*
const branches = async (req, res) => {
  res.render("dashboard/pages/branches", { layout: DashboardLayout });
};

const userManagement = async (req, res) => {
  res.render("dashboard/pages/user-mgt", { layout: DashboardLayout });
};
*/

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

// COMMENTED OUT: EJS rendering - React app handles audit log page
/*
const auditLogView = async (req, res) => {
  try {
    res.render("dashboard/pages/auditLogs", { layout: DashboardLayout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
*/

const auditLog = async (req, res) => {
  
   try {
    const { userId } = req.params; // Extract userId from URL parameters

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const logs = await fetchAuditLogsForUser(userId); // Call the service function
    
    res.json(logs); // Return the audit logs as JSON
  } catch (error) {
    next(error); // Pass errors to the global error handler
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

// COMMENTED OUT: Redirect - React app handles routing
/*
const getPickSend = async (req,res)=>{
  res.redirect('see-file');
};
*/

const getUsers = async (req, res) => {
  try {
    const usernamesString = req.query.usernames; // Expecting a single string
    
    const users = await fetchUsersByQuery(usernamesString);
    res.json(users);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const retrieveBranches = async (req, res) => {
  try {
    // Retrieve all branches with their associated department names
    const records = await branch.findAll({
      include: [
        {
          model: BranchDepartment,
          attributes: ["departmentName"],
        },
      ],
    });

    // Format the data to include concatenated department names
    const formattedRecords = records.map((branchRecord) => {
      const departments = branchRecord.branch_departments.map(
        (bd) => bd.departmentName
      );
      return {
        ...branchRecord.toJSON(),
        departmentNames: departments.join(", "), // Concatenate department names
      };
    });

    res.json({ message: "records", statusCode: 200, records: formattedRecords });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error retrieving records", statusCode: 500 });
  }
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

// COMMENTED OUT: EJS rendering - React app handles these pages
/*
const dwt = async (req, res) => {
  res.render("dashboard/pages/dwtScan", { layout: DashboardLayout });
};
*/

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
  const { user, password, rememberMe } = req.body;
  try {
    const result = await authenticateUser(user, password, rememberMe);
    // Set JWT cookie if rememberMe is true
    if (result.token) {
      res.cookie('remember_token', result.token, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }
    req.session.user = result.userId;
    res.json({ statusCode: 200, message: 'Login successful' });
  } catch (error) {
    res.status(404).json({ statusCode: 404, message: error.message });
  }
};

// Forgot password controller
const forgotPasswordController = async (req, res) => {
  const { username } = req.body;
  try {
    await forgotPassword(username);
    res.json({ statusCode: 200, message: 'A new password has been sent to your email. Please check your inbox.' });
  } catch (error) {
    res.status(400).json({ statusCode: 400, message: error.message });
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
  res.json({ statusCode: 200, message: 'Logged out successfully' });
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

// COMMENTED OUT: EJS rendering - Use getFileStructure endpoint instead
/*
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
*/

// JSON endpoint to return folder structure for SPA clients
const getFileStructure = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });

    const structure = await buildFolderStructure(DEFAULT_PATH || "C:\\e-archiveUploads", userId);
    return res.json({ statusCode: 200, fileStructure: structure });
  } catch (err) {
    console.error('getFileStructure error', err);
    return res.status(500).json({ statusCode: 500, message: err.message });
  }
};

const fileContent = async (req, res) => {
  const { fileName } = req.query;
  const userId = req.session.user;
  try {
    const { fullPath, mimeType } = await getFileContentLogic(fileName, userId);

    // Serve the file as binary data
    res.contentType(mimeType);
    res.sendFile(fullPath);
  } catch (error) {
    console.error(error);
    res.status(error.message.includes("missing") || error.message.includes("not found") ? 404 : 500).send(error.message);
  }
};

const accessControl = async (req, res) => {
  const { usernames } = req.query; // Extract usernames from query parameters
  
  const roles = req.body;

  if (!usernames) {
    return res.status(400).json({ message: "Usernames are required." });
  }

  try {
    // Split usernames by comma or space and trim extra spaces
    const usernameArray = usernames.split(/[\s,]+/).map(name => name.trim());

    const message = await updateUserPermissions(usernameArray, roles);
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

// Add this controller for sending files by username
const sendFilesToUsersController = async (req, res) => {
  try {
    const { users, files } = req.body;
    const { missingFiles } = await sendFilesToUsers(users, files);
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

const deleteFile = async (req, res) => {
  try {
    const { files } = req.body;
    const userId = req.session.user;
    const result = await deleteFiles(files, userId);
    res.json(result); // Always send a response!
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const removeDep = async (req, res) => {
  const {branchName, departmentName} = req.body
  try{
    const result = handleDeleteDepartment({branchName, departmentName});
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({success: false, error: error.message})
  }
};

/**
 * Controller for handling multiple file uploads (refactored to use new logic)
 */
const multipleFilesUpload = async (req, res) => {
  try {
    const files = req.files;
    const customNames = req.body.customNames;
    const userId = req.session.user; // Always get userId from session
    const result = await uploadMultipleFiles(files, customNames, userId);
    res.status(200).json(result);
  } catch (err) {
    console.error('Multiple upload error:', err);
    res.status(500).json({ error: 'Failed to upload files.' });
  }
};

const adminInformationToUsers = async (req, res) => {
  req.body = {userId, adminMesseage}
  
}

// Fetch latest admin messages (for dashboard display)
const getAdminMessages = async (req, res) => {
  try {
    // Fetch latest 5 messages, newest first
    const messages = await AdminActions.findAll({
      order: [["createdAt", "DESC"]],
      limit: 5,
      attributes: ["id", "message", "createdAt", "userId"],
    });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// JSON endpoint that returns dashboard data for the SPA (user info + admin messages)
const dashboardData = async (req, res) => {
  try {
    const userSession = req.session.user;
    if (!userSession) return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });

    const user = await User.findOne({
      where: { id: userSession },
      include: [
        { model: branch, attributes: ['name', 'id'] },
        { model: AuditLog, attributes: ['loginTime', 'logoutTime'], order: [['logoutTime', 'DESC']], limit: 1 },
      ],
    });

    const messages = await AdminActions.findAll({ order: [['createdAt', 'DESC']], limit: 5, attributes: ['id', 'message', 'createdAt', 'userId'] });

    return res.json({ statusCode: 200, user, messages });
  } catch (err) {
    console.error('dashboardData error', err);
    return res.status(500).json({ statusCode: 500, message: err.message });
  }
};

// Create admin message
const createAdminMessage = async (req, res) => {
  try {
    const userId = req.session.user; // Admin user ID from session
    const { message } = req.body;
    if (!userId || !message) return res.json({ success: false, error: 'Missing user or message' });
    const AdminActions = require('../model/adminActions');
    const newMsg = await AdminActions.create({ userId, message });
    res.json({ success: true, message: newMsg });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};

// Update admin message
const updateAdminMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const AdminActions = require('../model/adminActions');
    const msg = await AdminActions.findByPk(id);
    if (!msg) return res.json({ success: false, error: 'Message not found' });
    msg.message = message;
    await msg.save();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};

// Delete admin message
const deleteAdminMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const AdminActions = require('../model/adminActions');
    const msg = await AdminActions.findByPk(id);
    if (!msg) return res.json({ success: false, error: 'Message not found' });
    await msg.destroy();
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};

module.exports = {
  // COMMENTED OUT - EJS rendering functions (kept for reference, not exported)
  // login,
  // dashboard,
  // client,
  // userGroup,
  // editProfile,
  // userFileUpload,
  // branches,
  // userManagement,
  // auditLogView,
  // getPickSend,
  // seeFile,
  // dwt,
  
  // API-only exports
  destroyUserSession,
  updatePassword,
  dashboardData,
  getFileStructure,
  createUserGroup,
  retrieveUserGroup,
  removeUserGroup,
  createBranch,
  retrieveBranches,
  removeBranch,
  createUserManagement,
  retrieveUsers,
  removeUser,
  signIn,
  forgotPasswordController,
  uploadFile,
  fileContent,
  auditLog,
  GetUser,
  accessControl,
  uploadProfilePicture,
  getUsers,
  getUsersByEmail,
  sendFilesToUsersController,
  getDepartment,
  deleteFile,
  removeDep,
  multipleFilesUpload,
  getAdminMessages,
  createAdminMessage,
  updateAdminMessage,
  deleteAdminMessage,
};
