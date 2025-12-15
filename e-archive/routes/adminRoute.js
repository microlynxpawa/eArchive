const express = require("express");
const multer = require('multer');
const {
  // Removed EJS rendering imports: login, dashboard, client, userGroup, branches, 
  // userManagement, editProfile, userFileUpload, seeFile, auditLogView, getPickSend, dwt
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
  destroyUserSession,
  updatePassword,
  uploadFile,
  fileContent,
  auditLog,
  GetUser,
  dashboardData,
  getFileStructure,
  accessControl,
  uploadProfilePicture,
  getUsers,
  getUsersByEmail,
  getDepartment,
  deleteFile,
  removeDep,
  multipleFilesUpload,
  sendFilesToUsersController,
  forgotPasswordController,
  getAdminMessages,
  createAdminMessage,
  updateAdminMessage,
  deleteAdminMessage
} = require("../controllers/adminController");
const routeDectector = require("../middleware/routeDectector");
const authUser  = require('../middleware/authMiddleware');
const rememberMeMiddleware = require('../middleware/rememberMeMiddleware');
const passAuths = require("../middleware/passAuths");
const uploading = require("../util/multer.Config");

const app = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const User = require('../model/user');


// COMMENTED OUT: EJS page render - React app uses its own login page
// app.get("/", login);

// set sidebar active
app.use(routeDectector);

// Lightweight JSON endpoint for SPA to verify session/auth status.
// Runs the rememberMeMiddleware first so any remember-me token is applied.
app.get('/check-auth', rememberMeMiddleware, (req, res) => {
  if (req.session && req.session.user) return res.json({ statusCode: 200, message: 'Authenticated' });
  return res.status(401).json({ statusCode: 401, message: 'Unauthorized' });
});

app.post('/sign-in', signIn);
app.post('/forgot-password', forgotPasswordController);

// Use rememberMeMiddleware before authUser
app.use(rememberMeMiddleware);
app.use(authUser)

app.use(getUserPermissions);
app.use(passAuths)

// COMMENTED OUT: EJS page renders - React app has its own pages
// app.get("/dashboard", dashboard);
// app.get("/client", client);
// app.get("/user-group", userGroup);
// app.get("/branches", branches);
// app.get('/user-management', userManagement);
// app.get('/edit-profile', editProfile);
// app.get('/file-upload', userFileUpload);
// app.get("/audit-log", auditLogView);
// app.get("/pick-send", getPickSend);
// app.get("/see-file",seeFile);
// app.get("/scanFiles", (req, res)=>{ res.redirect("file-upload") });
// app.get("/dwt-scan", dwt);

// JSON endpoints - KEEP these for React app
app.get('/dashboard-data', dashboardData);
app.get('/file-structure', getFileStructure);
app.get('/file-content', fileContent);
app.get("/retrieve-user-group", retrieveUserGroup);
app.get("/retrieve-branches", retrieveBranches);
app.get('/retrieve-users', retrieveUsers);
app.get('/logout', destroyUserSession);
app.get("/audit-log/:userId", auditLog);
app.get("/getUser/:username", GetUser);
app.get("/searchUsers", getUsers);
app.get("/searchUsersByEmail", getUsersByEmail);
app.get("/getDepartment/:departmentName", getDepartment);
app.get("/messages", getAdminMessages);

app.post("/user-group", createUserGroup);
app.post("/remove-user-group", removeUserGroup);
app.post("/branches", createBranch);
app.post("/remove-branch", removeBranch);
app.post('/user-management', upload.none(),  createUserManagement);
app.post('/remove-user', removeUser);
app.post('/update-password', updatePassword);
app.post("/uploadFile", uploading.single('file'), uploadFile);
app.post("/searchUsers/permissions", accessControl);
app.post("/upload-profile-picture", uploading.single('profilePicture'), uploadProfilePicture);
app.post('/sendFilesToUsers', sendFilesToUsersController);
app.delete('/delete-file', deleteFile);
app.delete('/delete-dep', removeDep);

// Route for multiple file uploads
app.post('/uploadMultipleFiles', upload.array('files'), multipleFilesUpload);

// Admin message management routes
app.post('/message', createAdminMessage);
app.put('/message/:id', updateAdminMessage);
app.delete('/message/:id', deleteAdminMessage);

async function getUserPermissions(req, res,next){
  const userSessionId = req.session.user;
  const user = await User.findOne({where:{id: userSessionId}});
  res.locals.permissions = JSON.parse(user.dataValues.permissions);
  next();
}

module.exports = app;
