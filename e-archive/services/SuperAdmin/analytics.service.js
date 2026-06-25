const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../../dbConnect');
const AuditLog = require('../../model/auditLogs');
const File = require('../../model/file');
const FileSendingHistory = require('../../model/fileSendingHistory');
const fs = require('fs').promises;
const path = require('path');

function toSize(bytes) {
  return {
    bytes,
    kb: +(bytes / 1024).toFixed(2),
    mb: +(bytes / (1024 * 1024)).toFixed(2),
    gb: +(bytes / (1024 * 1024 * 1024)).toFixed(2),
  };
}

async function getFolderSize(dirPath) {
  let total = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await getFolderSize(full);
      } else if (entry.isFile()) {
        const stat = await fs.stat(full);
        total += stat.size;
      }
    }
  } catch {
    // skip unreadable paths
  }
  return total;
}

async function getSystemMetrics(from, to) {
  const auditWhere = { loginTime: { [Op.between]: [from, to] } };
  const fileWhere = { createdAt: { [Op.between]: [from, to] } };
  const sendWhere = { sentAt: { [Op.between]: [from, to] } };

  const [
    uniqueUsers,
    totalSessions,
    sessionsWithUploads,
    sessionsWithViews,
    sessionsWithDeletions,
    filesUploaded,
    sendAgg,
  ] = await Promise.all([
    AuditLog.count({ where: auditWhere, distinct: true, col: 'userId' }),
    AuditLog.count({ where: auditWhere }),
    AuditLog.count({ where: { ...auditWhere, uploaded: true } }),
    AuditLog.count({ where: { ...auditWhere, viewed: true } }),
    AuditLog.count({ where: { ...auditWhere, deleted: true } }),
    File.count({ where: fileWhere }),
    FileSendingHistory.findOne({
      where: sendWhere,
      attributes: [
        [fn('COUNT', col('id')), 'ops'],
        [fn('SUM', col('fileCount')), 'total'],
      ],
      raw: true,
    }),
  ]);

  return {
    uniqueUsers,
    totalSessions,
    sessionsWithUploads,
    sessionsWithViews,
    sessionsWithDeletions,
    filesUploaded,
    sendOps: parseInt(sendAgg?.ops || 0),
    filesSent: parseInt(sendAgg?.total || 0),
  };
}

async function getPerUserBreakdown(from, to) {
  const rows = await sequelize.query(
    `SELECT
       u.id          AS userId,
       u.username,
       u.fullname,
       b.name        AS branch,
       ac.name       AS department,
       COALESCE(al.loginCount,    0) AS loginCount,
       COALESCE(al.uploadSessions,0) AS uploadSessions,
       COALESCE(al.viewSessions,  0) AS viewSessions,
       COALESCE(al.deleteSessions,0) AS deleteSessions,
       COALESCE(f.filesOnDisk,    0) AS filesOnDisk,
       COALESCE(s.filesSent,      0) AS filesSent,
       COALESCE(r.filesReceived,  0) AS filesReceived
     FROM users u
     LEFT JOIN branches b         ON u.branchId    = b.id
     LEFT JOIN archive_categories ac ON u.userGroupId = ac.id
     LEFT JOIN (
       SELECT userId,
         COUNT(*)                                                      AS loginCount,
         SUM(CASE WHEN uploaded = 1 THEN 1 ELSE 0 END)               AS uploadSessions,
         SUM(CASE WHEN viewed   = 1 THEN 1 ELSE 0 END)               AS viewSessions,
         SUM(CASE WHEN deleted  = 1 THEN 1 ELSE 0 END)               AS deleteSessions
       FROM AuditLogs
       WHERE loginTime BETWEEN :from AND :to
       GROUP BY userId
     ) al ON u.id = al.userId
     LEFT JOIN (
       SELECT userId, COUNT(*) AS filesOnDisk
       FROM Files
       WHERE createdAt BETWEEN :from AND :to
       GROUP BY userId
     ) f ON u.id = f.userId
     LEFT JOIN (
       SELECT senderId, SUM(fileCount) AS filesSent
       FROM file_sending_history
       WHERE sentAt BETWEEN :from AND :to
       GROUP BY senderId
     ) s ON u.id = s.senderId
     LEFT JOIN (
       SELECT receiverId, SUM(fileCount) AS filesReceived
       FROM file_sending_history
       WHERE sentAt BETWEEN :from AND :to AND receiverId IS NOT NULL
       GROUP BY receiverId
     ) r ON u.id = r.receiverId
     WHERE (al.loginCount IS NOT NULL
         OR f.filesOnDisk IS NOT NULL
         OR s.filesSent   IS NOT NULL
         OR r.filesReceived IS NOT NULL)
     ORDER BY COALESCE(al.loginCount, 0) DESC`,
    { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
  );

  return rows.map(r => ({
    userId:         parseInt(r.userId),
    username:       r.username || '—',
    fullname:       r.fullname || '—',
    branch:         r.branch || '—',
    department:     r.department || '—',
    loginCount:     parseInt(r.loginCount),
    uploadSessions: parseInt(r.uploadSessions),
    viewSessions:   parseInt(r.viewSessions),
    deleteSessions: parseInt(r.deleteSessions),
    filesOnDisk:    parseInt(r.filesOnDisk),
    filesSent:      parseInt(r.filesSent),
    filesReceived:  parseInt(r.filesReceived),
  }));
}

async function getUploadTrend(from, to) {
  const diffDays = (new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24);

  let groupExpr;
  if (diffDays <= 31) {
    groupExpr = "DATE(createdAt)";
  } else if (diffDays <= 90) {
    groupExpr = "DATE_FORMAT(createdAt, '%Y-%u')";
  } else {
    groupExpr = "DATE_FORMAT(createdAt, '%Y-%m')";
  }

  const rows = await sequelize.query(
    `SELECT ${groupExpr} AS date, COUNT(*) AS count
     FROM Files
     WHERE createdAt BETWEEN :from AND :to
     GROUP BY date
     ORDER BY date ASC`,
    { replacements: { from, to }, type: sequelize.QueryTypes.SELECT }
  );

  return rows.map(r => ({ date: String(r.date), count: parseInt(r.count) }));
}

async function getStorageInfo() {
  const folderPath = (process.env.FOLDER || '').replace(/"/g, '');
  const folderBytes = folderPath ? await getFolderSize(folderPath) : 0;

  const [dbRow] = await sequelize.query(
    `SELECT SUM(data_length + index_length) AS bytes
     FROM information_schema.tables
     WHERE table_schema = DATABASE()`,
    { type: sequelize.QueryTypes.SELECT }
  );
  const dbBytes = parseInt(dbRow?.bytes || 0);

  return { folder: toSize(folderBytes), db: toSize(dbBytes) };
}

module.exports = { getSystemMetrics, getPerUserBreakdown, getUploadTrend, getStorageInfo };
