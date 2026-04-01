const FileSendingHistory = require('../../model/fileSendingHistory');
const User = require('../../model/user');
const File = require('../../model/file');
const { Op } = require('sequelize');

/**
 * Fetch file sending history for a user and enrich with file paths from File table
 * @param {number} userId - ID of user to get history for
 * @param {number} limit - Number of records to return (default 50)
 * @param {string} scope - 'sent' = files sent by user, 'received' = files received by user
 */
const getFileSendingHistory = async (userId, limit = 50, scope = 'sent') => {
  try {
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 500); // Cap between 1-500

    let whereClause = {};
    if (scope === 'sent') {
      whereClause = { senderId: userId };
    } else if (scope === 'received') {
      whereClause = { receiverId: userId };
    }

    const records = await FileSendingHistory.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'fullname'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'fullname'] },
      ],
      order: [['sentAt', 'DESC']],
      limit: limitNum,
    });

    // Enrich records with file paths from File table
    for (const record of records) {
      const filePaths = [];
      
      if (Array.isArray(record.fileNames)) {
        for (const fileName of record.fileNames) {
          try {
            const fileRecord = await File.findOne({ where: { fileName } });
            if (fileRecord && fileRecord.filePath) {
              // Combine filePath and fileName to get full path
              const fullPath = require('path').join(fileRecord.filePath, fileName);
              filePaths.push(fullPath);
            }
          } catch (err) {
            console.warn(`[getFileSendingHistory] Could not find file path for ${fileName}:`, err.message);
          }
        }
      } else if (record.fileNames) {
        try {
          const fileRecord = await File.findOne({ where: { fileName: record.fileNames } });
          if (fileRecord && fileRecord.filePath) {
            const fullPath = require('path').join(fileRecord.filePath, record.fileNames);
            filePaths.push(fullPath);
          }
        } catch (err) {
          console.warn(`[getFileSendingHistory] Could not find file path for ${record.fileNames}:`, err.message);
        }
      }
      
      // Add filePath array to the record
      record.dataValues.filePath = filePaths;
    }

    return records;
  } catch (err) {
    console.error('[getFileSendingHistory] Error:', err);
    throw err;
  }
};

/**
 * Get file sending history for a specific receiver
 * Useful for finding all files sent TO a particular user
 */
const getFileSendingHistoryByReceiver = async (receiverUsername, limit = 50) => {
  try {
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 500);

    const records = await FileSendingHistory.findAll({
      where: { receiverUsername },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'fullname'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'fullname'] },
      ],
      order: [['sentAt', 'DESC']],
      limit: limitNum,
    });

    // Enrich records with file paths from File table
    for (const record of records) {
      const filePaths = [];
      
      if (Array.isArray(record.fileNames)) {
        for (const fileName of record.fileNames) {
          try {
            const fileRecord = await File.findOne({ where: { fileName } });
            if (fileRecord && fileRecord.filePath) {
              const fullPath = require('path').join(fileRecord.filePath, fileName);
              filePaths.push(fullPath);
            }
          } catch (err) {
            console.warn(`[getFileSendingHistoryByReceiver] Could not find file path for ${fileName}:`, err.message);
          }
        }
      }
      
      record.dataValues.filePath = filePaths;
    }

    return records;
  } catch (err) {
    console.error('[getFileSendingHistoryByReceiver] Error:', err);
    throw err;
  }
};

/**
 * Get all files sent by a user
 */
const getFilesSentByUser = async (senderUsername, limit = 50) => {
  try {
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 500);

    const records = await FileSendingHistory.findAll({
      where: { senderUsername },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'fullname'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'fullname'] },
      ],
      order: [['sentAt', 'DESC']],
      limit: limitNum,
    });

    // Enrich records with file paths from File table
    for (const record of records) {
      const filePaths = [];
      
      if (Array.isArray(record.fileNames)) {
        for (const fileName of record.fileNames) {
          try {
            const fileRecord = await File.findOne({ where: { fileName } });
            if (fileRecord && fileRecord.filePath) {
              const fullPath = require('path').join(fileRecord.filePath, fileName);
              filePaths.push(fullPath);
            }
          } catch (err) {
            console.warn(`[getFilesSentByUser] Could not find file path for ${fileName}:`, err.message);
          }
        }
      }
      
      record.dataValues.filePath = filePaths;
    }

    return records;
  } catch (err) {
    console.error('[getFilesSentByUser] Error:', err);
    throw err;
  }
};

module.exports = {
  getFileSendingHistory,
  getFileSendingHistoryByReceiver,
  getFilesSentByUser,
};
