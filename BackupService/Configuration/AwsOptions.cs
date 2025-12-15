namespace BackupService.Configuration
{
    public class AwsOptions
    {
        public string? BucketName { get; set; }
        public string? Region { get; set; }
        public string? AccessKey { get; set; }
        public string? SecretAccessKey { get; set; }
    }
}
