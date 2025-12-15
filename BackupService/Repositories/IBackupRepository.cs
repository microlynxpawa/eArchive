using System.Threading.Tasks;

namespace BackupService.Repositories
{
    public interface IBackupRepository
    {
        Task<string> CreateBackupAsync();
        Task<string> CreateFullBackupAsync(string uploadsFolderPath);
    }
}
