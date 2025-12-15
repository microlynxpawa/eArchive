using Microsoft.Extensions.Hosting;
using System;
using System.Threading;
using System.Threading.Tasks;
using BackupService.Services;

namespace BackupService.Background
{
    public class DailyBackupService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly string _uploadsFolder = @"C:\e-archiveUploads";

        public DailyBackupService(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.Now;
                var nextRun = new DateTime(now.Year, now.Month, now.Day, 11, 0, 0);
                if (now > nextRun)
                    nextRun = nextRun.AddDays(1);
                var delay = nextRun - now;
                await Task.Delay(delay, stoppingToken);
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var backupService = scope.ServiceProvider.GetRequiredService<IBackupService>();
                        await backupService.BackupToLocalAsync(_uploadsFolder);
                        Console.WriteLine($"Backup completed at {DateTime.Now}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Backup failed: {ex.Message}");
                }
            }
        }
    }
}
