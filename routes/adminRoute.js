const express = require("express");
const multer = require('multer')
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
  deleteFile,
} = require("../controllers/adminController");
const routeDectector = require("../middleware/routeDectector");
const authUser  = require('../middleware/authMiddleware')
const uploading = require("../util/multer.Config")

const app = express.Router();
const upload = multer()
const User = require('../model/user')
const bcrypt = require("bcryptjs");


app.get("/", login);

// set sidebar active
app.use(routeDectector);

app.post('/sign-in', signIn)

app.use(authUser)

app.use(getUserPermissions)

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
app.get("/audit-log", auditLog);
app.get("/getUser/:username", GetUser);
app.get("/pick-send", getPickSend);
app.get("/see-file",seeFile);
app.get("/searchUsers", getUsers);
app.get("/searchUsersByEmail", getUsersByEmail);
app.get("/scanFiles", (req, res)=>{ res.redirect("file-upload") })
app.get("/getDepartment/:departmentName", getDepartment)

app.post("/user-group", createUserGroup);
app.post("/remove-user-group", removeUserGroup);
app.post("/branches", createBranch);
app.post("/remove-branch", removeBranch);
app.post('/user-management', upload.none(),  createUserManagement);
app.post('/remove-user', removeUser);
app.post('/update-password', updatePassword);
// app.post('/file-upload', saveUserFileUpload);
app.post("/uploadFile", uploading.single('file'), uploadFile);
app.post("/getUser/:username/permissions", accessControl);
app.post("/upload-profile-picture", uploading.single('profilePicture'), uploadProfilePicture);
app.post('/sendFilesToUsers', sendFiles);
app.post('/sendFilesToUsers-email', sendFilesEmail);
app.post("/updateDepartmentPermissions/:departmentName", departmentAccessControl);
app.delete('/delete-file', deleteFile);

async function getUserPermissions(req, res,next){
  const userSessionId = req.session.user;
  const user = await User.findOne({where:{id: userSessionId}});
  res.locals.permissions = JSON.parse(user.dataValues.permissions);
  next();
}

module.exports = app;
