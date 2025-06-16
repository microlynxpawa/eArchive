const express = require("express");
const multer = require('multer');
const {
  login,
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
  destroyUserSession,
  editProfile,
  updatePassword,
  userFileUpload,
  uploadFile,
  seeFile,
  auditLog,
  auditLogView,
  GetUser,
  accessControl,
  uploadProfilePicture,
  getPickSend,
  getUsers,
  getUsersByEmail,
  sendFilesEmail,
  getDepartment,
  deleteFile,
  removeDep,
  dwt,
  multipleFilesUpload
} = require("../controllers/adminController");
const routeDectector = require("../middleware/routeDectector");
const authUser  = require('../middleware/authMiddleware');
const passAuths = require("../middleware/passAuths");
const uploading = require("../util/multer.Config");

const app = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const User = require('../model/user');


app.get("/", login);

// set sidebar active
app.use(routeDectector);

app.post('/sign-in', signIn)

app.use(authUser)

app.use(getUserPermissions);
app.use(passAuths)

app.get("/dashboard", dashboard);
app.get("/client", client);
app.get("/user-group", userGroup);
app.get("/retrieve-user-group", retrieveUserGroup);
app.get("/branches", branches);
app.get("/retrieve-branches", retrieveBranches);
app.get('/user-management', userManagement);
app.get('/retrieve-users', retrieveUsers);
app.get('/edit-profile', editProfile);
app.get('/file-upload', userFileUpload);
app.get('/logout', destroyUserSession);
app.get("/audit-log", auditLogView);
app.get("/audit-log/:userId", auditLog);
app.get("/getUser/:username", GetUser);
app.get("/pick-send", getPickSend);
app.get("/see-file",seeFile);
app.get("/searchUsers", getUsers);
app.get("/searchUsersByEmail", getUsersByEmail);
app.get("/scanFiles", (req, res)=>{ res.redirect("file-upload") });
app.get("/getDepartment/:departmentName", getDepartment);
app.get("/dwt-scan", dwt);

app.post("/user-group", createUserGroup);
app.post("/remove-user-group", removeUserGroup);
app.post("/branches", createBranch);
app.post("/remove-branch", removeBranch);
app.post('/user-management', upload.none(),  createUserManagement);
app.post('/remove-user', removeUser);
app.post('/update-password', updatePassword);
// app.post('/file-upload', saveUserFileUpload);
app.post("/uploadFile", uploading.single('file'), uploadFile);
app.post("/searchUsers/permissions", accessControl);
app.post("/upload-profile-picture", uploading.single('profilePicture'), uploadProfilePicture);
app.post('/sendFilesToUsers-email', sendFilesEmail);
app.delete('/delete-file', deleteFile);
app.delete('/delete-dep', removeDep);

// Route for multiple file uploads
app.post('/uploadMultipleFiles', upload.array('files'), multipleFilesUpload);

async function getUserPermissions(req, res,next){
  const userSessionId = req.session.user;
  const user = await User.findOne({where:{id: userSessionId}});
  res.locals.permissions = JSON.parse(user.dataValues.permissions);
  next();
}

module.exports = app;
