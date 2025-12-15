using System.Threading.Tasks;
using BackupService.Repositories;

namespace BackupService.Services
{
    public class BackupService : IBackupService
    {
        private readonly IBackupRepository _backupRepository;
        private readonly ICloudStorageRepository _cloudStorageRepository;

        public BackupService(
            IBackupRepository backupRepository,
            ICloudStorageRepository cloudStorageRepository)
        {
            _backupRepository = backupRepository;
            _cloudStorageRepository = cloudStorageRepository;
        }

        public async Task BackupToLocalAsync(string uploadsFolderPath)
        {
            await _backupRepository.CreateFullBackupAsync(uploadsFolderPath);
        }

        public async Task BackupToCloudAsync()
        {
            try
            {
                var filePath = await _backupRepository.CreateBackupAsync();
                await _cloudStorageRepository.UploadFileAsync(filePath);
            }
            catch (System.Exception ex)
            {
                // Log error here
                System.Console.WriteLine($"Error during cloud backup: {ex.Message}");
            }
        }
    }
}