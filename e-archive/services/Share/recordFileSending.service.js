const FileSendingHistory = require('../../model/fileSendingHistory');
const User = require('../../model/user');

/**
 * Record a file sending operation in the audit trail
 * @param {number} senderId - ID of user sending the files
 * @param {string} senderUsername - Username of sender
 * @param {string|array} receiverUsername - Username(s) of receiver(s)
 * @param {array} fileNames - Array of file names being sent
 * @param {string} batchName - Optional batch name if files were uploaded as batch
 * @param {array} filePaths - Optional array of file paths for file interaction
 */
const recordFileSending = async (senderId, senderUsername, receiverUsername, fileNames, batchName = null, filePaths = null) => {
  try {
    // Handle both single string and array of receivers
    const receivers = Array.isArray(receiverUsername) ? receiverUsername : [receiverUsername];

    // Create a history record for each receiver
    const historyRecords = [];

    for (const receiver of receivers) {
      if (!receiver || typeof receiver !== 'string') {
        console.warn('[recordFileSending] Invalid receiver username, skipping:', receiver);
        continue;
      }

      try {
        // Try to find the receiver user for the receiverId
        let receiverId = null;
        try {
          const receiverUser = await User.findOne({ where: { username: receiver } });
          if (receiverUser) {
            receiverId = receiverUser.id;
          }
        } catch (err) {
          console.warn(`[recordFileSending] Could not find receiver user ID for ${receiver}:`, err.message);
        }

        // Create the history record
        const record = await FileSendingHistory.create({
          senderId,
          senderUsername,
          receiverUsername: receiver,
          receiverId,
          fileNames: Array.isArray(fileNames) ? fileNames : [fileNames],
          filePath: Array.isArray(filePaths) ? filePaths : (filePaths ? [filePaths] : []),
          batchName,
          fileCount: Array.isArray(fileNames) ? fileNames.length : 1,
          sentAt: new Date(),
        });

        historyRecords.push(record);
        console.log(`[recordFileSending] Recorded sending of ${Array.isArray(fileNames) ? fileNames.length : 1} file(s) from ${senderUsername} to ${receiver}`);
      } catch (err) {
        console.error(`[recordFileSending] Error recording history for receiver ${receiver}:`, err);
      }
    }

    return historyRecords;
  } catch (err) {
    console.error('[recordFileSending] Error:', err);
    // Don't throw - we don't want a history recording error to break the file send operation
    return [];
  }
};

module.exports = recordFileSending;
