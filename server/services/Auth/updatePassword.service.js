// Service Function
const bcrypt = require('bcryptjs');
const User = require('../../model/user');

const updateUserPassword = async (userId, oldPassword, newPassword) => {
  try {
    // Find the user by ID
    const user = await User.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error("User not found");
    }

    // Compare old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new Error("Invalid old password");
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    await User.update({ password: hashedPassword }, { where: { id: userId } });

    return { message: "Password updated successfully", statusCode: 200 };
  } catch (error) {
    throw new Error(error.message || "Unable to process request");
  }
};

module.exports = updateUserPassword;
