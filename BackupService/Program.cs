using BackupService.Configuration;
using BackupService.Repositories;
using BackupService.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.OpenApi.Models;
using Amazon.S3;
using Amazon;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Register configuration options
builder.Services.Configure<MySqlOptions>(builder.Configuration.GetSection("MySql"));
builder.Services.Configure<AwsOptions>(builder.Configuration.GetSection("AWS"));

// Register IAmazonS3 for DI using credentials from config
builder.Services.AddSingleton<IAmazonS3>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    var awsOptions = config.GetSection("AWS").Get<AwsOptions>();
    return new AmazonS3Client(
        awsOptions.AccessKey,
        awsOptions.SecretAccessKey,
        Amazon.RegionEndpoint.GetBySystemName(awsOptions.Region)
    );
});

// Register repositories and services
builder.Services.AddScoped<IBackupRepository, BackupRepository>();
builder.Services.AddScoped<ICloudStorageRepository, CloudStorageRepository>();
builder.Services.AddScoped<IBackupService, BackupService.Services.BackupService>();
builder.Services.AddHostedService<BackupService.Background.DailyBackupService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();