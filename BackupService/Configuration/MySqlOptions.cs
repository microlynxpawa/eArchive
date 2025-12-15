namespace BackupService.Configuration
{
    public class MySqlOptions
    {
        public string? User { get; set; }
        public string? Password { get; set; }
        public string? Database { get; set; }
        public string? DumpPath { get; set; }
        public string? BackupOutputDir { get; set; }
    }
}
