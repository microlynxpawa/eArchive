using System;
// Standardize Api response format via the controller or services when needed
namespace BackupService.Models
{
    public class BackupRequestDto
    {
        public string BackupType { get; set; } // "local" or "cloud"
        public DateTime RequestTime { get; set; }
        public string RequestedBy { get; set; } // User or system that requested the backup

        public BackupRequestDto(string backupType, string requestedBy)
        {
            BackupType = backupType;
            RequestTime = DateTime.UtcNow;
            RequestedBy = requestedBy;
        }
    }
}