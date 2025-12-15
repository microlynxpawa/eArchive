  const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../model/user');
const { createOrUpdateLoginRecord } = require('../../util/directory');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';
const JWT_EXPIRES = '30d'; // 30 days for remember me

async function authenticateUser(username, password, rememberMe = false) {
  if (!username) {
    throw new Error('User required');
  }

  if (!password) {
    throw new Error('Password required');
  }

  // Find the user record
  const userRecord = await User.findOne({ where: { username } });

  if (!userRecord) {
    throw new Error('Invalid credentials');
  }

  // Validate password
  const isValidPassword = await bcrypt.compare(password, userRecord.password);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Create or update login record
  await createOrUpdateLoginRecord(userRecord.id, username);

  // If rememberMe, generate JWT
  let token = null;
  if (rememberMe) {
    token = jwt.sign({ userId: userRecord.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  }

  return {
    userId: userRecord.id,
    route: '/admin/dashboard',
    token,
  };
}

// Forgot password logic
async function forgotPassword(usernameOrEmail) {
  if (!usernameOrEmail) throw new Error('Username or email required');

  // Find user by username or email
  const user = await User.findOne({
    where: {
      [User.sequelize.Op.or]: [
        { username: usernameOrEmail },
        { email: usernameOrEmail },
        { private_email: usernameOrEmail },
      ],
    },
  });
  if (!user) throw new Error('No user found with that username or email.');

  // Generate random 8-char password
  const newPassword = crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  const hashed = await bcrypt.hash(newPassword, 10);
  user.password = hashed;
  await user.save();

  // Send email with new password
  await sendPasswordEmail(user.email, user.fullname, newPassword);
  return true;
}

async function sendPasswordEmail(email, name, newPassword) {
  // Configure your transporter (update with your SMTP details)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || 'user@example.com',
      pass: process.env.SMTP_PASS || 'password',
    },
  });
  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@e-archive.com',
    to: email,
    subject: 'Your eArchive Password Reset',
    text: `Hello ${name},\n\nYour password has been reset. Your new password is: ${newPassword}\n\nPlease log in and change your password as soon as possible.\n\nIf you did not request this, please contact support.`,
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { authenticateUser, forgotPassword };
