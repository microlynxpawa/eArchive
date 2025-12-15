using System.Threading.Tasks;

namespace BackupService.Repositories
{
    public interface ICloudStorageRepository
    {
        Task UploadFileAsync(string filePath);
    }
}