using Amazon.S3;
using Amazon.S3.Model;
using Microsoft.Extensions.Configuration;
using System.IO;
using System.Threading.Tasks;

namespace BackupService.Repositories
{
    public class CloudStorageRepository : ICloudStorageRepository
    {
        private readonly IAmazonS3 _s3Client;
        private readonly string _bucketName;

        public CloudStorageRepository(IAmazonS3 s3Client, IConfiguration config)
        {
            _s3Client = s3Client;
            _bucketName = config["AWS:BucketName"];
            if (string.IsNullOrEmpty(_bucketName))
                throw new System.Exception("AWS S3 bucket name is not configured.");
        }

        public async Task UploadFileAsync(string filePath)
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = _bucketName,
                Key = Path.GetFileName(filePath),
                FilePath = filePath,
            };

            await _s3Client.PutObjectAsync(putRequest);
        }
    }
}