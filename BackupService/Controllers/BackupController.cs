using Microsoft.AspNetCore.Mvc;
using BackupService.Services;
using System.Threading.Tasks;
using System;
using Microsoft.Extensions.Options;
using BackupService.Configuration;
using Microsoft.Extensions.Configuration;
using MySql.Data.MySqlClient;

namespace BackupService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BackupController : ControllerBase
    {
        private readonly IBackupService _backupService; // Set an empty variable/field that expects data in the format of IBackupService interface.
        private readonly AwsOptions _awsOptions;
        private readonly IConfiguration _config;

        public BackupController(IBackupService backupService, IOptions<AwsOptions> awsOptions, IConfiguration config)
        {
            _backupService = backupService;   // Give a value to the field/variable in the constructor by looking for a similar class in the Program.cs so the variable can instanciate the class or just use dependency injection
            _awsOptions = awsOptions.Value;
            _config = config;
        }

        // POST: /api/backup/local
        [HttpPost("local")]
        public async Task<IActionResult> BackupToLocal() // IActionResult is an interface containing standardized responses for http verbs so we return http responses and status codes
        {
            try
            {
                // Path to uploads folder
                string uploadsFolder = @"C:\e-archiveUploads";
                await _backupService.BackupToLocalAsync(uploadsFolder);
                return Ok("Local backup completed successfully.");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Local backup failed: {ex.Message}");
            }
        }

        // POST: /api/backup/cloud
        [HttpPost("cloud")]
        public async Task<IActionResult> BackupToCloud()
        {
            try
            {
                await _backupService.BackupToCloudAsync();
                return Ok("Cloud backup completed successfully.");
            }
            catch (Exception ex)
            {
                // Return a 500 error with the exception message if backup fails
                return StatusCode(500, $"Cloud backup failed: {ex.Message}");
            }
        }

        [HttpPost("s3-test")]
        public async Task<IActionResult> TestS3Upload()
        {
            var accessKey = _awsOptions.AccessKey;
            var secretKey = _awsOptions.SecretAccessKey;
            var region = Amazon.RegionEndpoint.GetBySystemName(_awsOptions.Region);
            var bucket = _awsOptions.BucketName;

            // Defensive check for credentials
            if (string.IsNullOrEmpty(accessKey) || string.IsNullOrEmpty(secretKey))
                return StatusCode(500, new { error = "AWS credentials are missing in configuration." });

            var s3Client = new Amazon.S3.AmazonS3Client(accessKey, secretKey, region);

            var request = new Amazon.S3.Model.PutObjectRequest
            {
                BucketName = bucket,
                Key = "test-folder/hello.txt",
                ContentBody = "This is a test file from the controller."
            };

            try
            {
                var response = await s3Client.PutObjectAsync(request);
                return Ok(new { message = "Uploaded test file to S3 successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("add-test-user")]
        public IActionResult AddTestUser()
        {
            var dbSection = _config.GetSection("MySql");
            var connStr = $"Server=localhost;Database={dbSection["Database"]};User={dbSection["User"]};Password={dbSection["Password"]};";
            try
            {
                using var conn = new MySqlConnection(connStr);
                conn.Open();

                var cmd = conn.CreateCommand();
                cmd.CommandText = @"INSERT INTO users
    (username, fullname, email, private_email, password, permissions, branchId, userGroupId, folderPath, profilePicturePath, createdAt, updatedAt)
    VALUES (@username, @fullname, @email, @private_email, @password, @permissions, @branchId, @userGroupId, @folderPath, @profilePicturePath, @createdAt, @updatedAt);";
                cmd.Parameters.AddWithValue("@username", "NetUserTest2");
                cmd.Parameters.AddWithValue("@fullname", "Net User Test2");
                cmd.Parameters.AddWithValue("@email", "netuser2@test.com");
                cmd.Parameters.AddWithValue("@private_email", "netuserpri2vate@test.com");
                cmd.Parameters.AddWithValue("@password", "testpassword"); // Hash in production!
                cmd.Parameters.AddWithValue("@permissions", "");
                cmd.Parameters.AddWithValue("@branchId", 1);
                cmd.Parameters.AddWithValue("@userGroupId", 1);
                cmd.Parameters.AddWithValue("@folderPath", "");
                cmd.Parameters.AddWithValue("@profilePicturePath", "");
                cmd.Parameters.AddWithValue("@createdAt", DateTime.UtcNow);
                cmd.Parameters.AddWithValue("@updatedAt", DateTime.UtcNow);

                cmd.ExecuteNonQuery();

                return Ok("User Added successfully");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error adding user: {ex.Message}");
            }
        }

        [HttpGet("hello")]
        public IActionResult HelloWorld()
        {
            return Ok("Hello World");
        }
    }
}