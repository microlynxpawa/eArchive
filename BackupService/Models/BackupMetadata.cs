using System;

// Standardize incoming Api requests format via the controller or services when needed
namespace BackupService.Models
{
    public class BackupMetadata
    {
        public string? FileName { get; set; } // e.g., backup_20250617_093000.sql

        public DateTime Timestamp { get; set; } // When the backup was created

        public string? StorageLocation { get; set; } // "Local" or AWS bucket URL
    }
}