const AuditLog = require("../../model/auditLogs")

/**
 * Fetch audit logs for a specific user.
 * @param {number} userId - The ID of the user to fetch logs for.
 * @returns {Promise<Array>} - Array of audit log records.
 */
const fetchAuditLogsForUser = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required to fetch audit logs");
  }

  try {
    const logs = await AuditLog.findAll({
      where: { userId },
      order: [["id", "DESC"]],
    });

    return logs;
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    throw new Error("Failed to fetch audit logs.");
  }
};

module.exports = fetchAuditLogsForUser ;
