using System.Threading.Tasks;

namespace BackupService.Services
{
    public interface IBackupService
    {
        Task BackupToLocalAsync(string uploadsFolderPath);
        Task BackupToCloudAsync();
    }
}