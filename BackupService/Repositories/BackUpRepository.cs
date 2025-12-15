using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Microsoft.Extensions.Options;
using BackupService.Configuration;

namespace BackupService.Repositories
{
    public class BackupRepository : IBackupRepository
    {
        private readonly MySqlOptions _options;
        public BackupRepository(IOptions<MySqlOptions> options)
        {
            _options = options.Value;
        }

        public async Task<string> CreateBackupAsync()
        {
            string backupDirectory = _options.BackupOutputDir;
            Directory.CreateDirectory(backupDirectory);

            string fileName = $"backup_{DateTime.Now:yyyyMMdd_HHmmss}.sql";
            string filePath = Path.Combine(backupDirectory, fileName);

            string command = $"\"{_options.DumpPath}\" --user={_options.User} --password={_options.Password} {_options.Database} > \"{filePath}\"";

            var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = $"/C {command}",
                    RedirectStandardOutput = false,
                    RedirectStandardError = false,
                    UseShellExecute = false,
                    CreateNoWindow = true
                }
            };

            try
            {
                process.Start();
                await process.WaitForExitAsync();

                if (process.ExitCode != 0)
                {
                    throw new Exception("mysqldump failed with exit code " + process.ExitCode);
                }

                return filePath;
            }
            catch (Exception ex)
            {
                throw new ApplicationException("Backup process failed.", ex);
            }
        }

        public async Task<string> CreateFullBackupAsync(string uploadsFolderPath)
        {
            string dateStr = DateTime.UtcNow.ToString("yyyy-MM-dd-HH-mm-ss");
            string backupRoot = @"C:\e-archive-back-up-data";
            if (!Directory.Exists(backupRoot))
                Directory.CreateDirectory(backupRoot);
            string backupFolder = Path.Combine(backupRoot, $"{dateStr}-bcp");
            Directory.CreateDirectory(backupFolder);

            // 1. DB backup using MySql.Data.MySqlClient
            string dbBackupFile = Path.Combine(backupFolder, $"{_options.Database}-backup.sql");
            string connStr = $"Server=localhost;Database={_options.Database};User={_options.User};Password={_options.Password};";
            try
            {
                using (var conn = new MySql.Data.MySqlClient.MySqlConnection(connStr))
                {
                    conn.Open();
                    using (var cmd = conn.CreateCommand())
                    {
                        cmd.CommandText = $"SHOW TABLES";
                        using (var reader = cmd.ExecuteReader())
                        {
                            using (var writer = new StreamWriter(dbBackupFile))
                            {
                                while (reader.Read())
                                {
                                    string table = reader.GetString(0);
                                    writer.WriteLine($"-- Data for table {table}");
                                    // You can expand this to dump table data if needed
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Database connection or backup failed: {ex.Message}");
            }

            // 2. Copy uploads folder
            string uploadsBackupFolder = Path.Combine(backupFolder, "e-archiveUploads");
            CopyDirectory(uploadsFolderPath, uploadsBackupFolder);

            return backupFolder;
        }

        private void CopyDirectory(string sourceDir, string destDir)
        {
            if (!Directory.Exists(sourceDir))
                throw new DirectoryNotFoundException($"Source directory not found: {sourceDir}");
            Directory.CreateDirectory(destDir);
            foreach (var file in Directory.GetFiles(sourceDir))
            {
                var destFile = Path.Combine(destDir, Path.GetFileName(file));
                File.Copy(file, destFile, true);
            }
            foreach (var dir in Directory.GetDirectories(sourceDir))
            {
                var destSubDir = Path.Combine(destDir, Path.GetFileName(dir));
                CopyDirectory(dir, destSubDir);
            }
        }
    }
}