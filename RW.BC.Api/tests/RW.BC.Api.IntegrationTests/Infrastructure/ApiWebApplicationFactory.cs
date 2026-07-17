using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RW.BC.Infrastructure.Persistence;
using RW.BC.Infrastructure.Persistence._Extensions;
using Testcontainers.PostgreSql;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Infrastructure;

[ExcludeFromCodeCoverage]
public sealed class ApiWebApplicationFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17.6")
        .WithDatabase("bitchicken_api_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();
        await MigrateAsync();
    }

    private async Task MigrateAsync()
    {
        await using var scope = Services.CreateAsyncScope();
        var ctx = scope.ServiceProvider.GetRequiredService<DataContext>();
        await ctx.Database.MigrateAsync();
    }

    public new async Task DisposeAsync()
    {
        await _container.DisposeAsync();
        await base.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration(config =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                [$"ConnectionStrings:{DIExtension.ConnectionStringName}"] = ConnectionString,
                ["RateLimiting:Global:PermitLimit"] = "100000",
                ["RateLimiting:Global:WindowSeconds"] = "1",
                ["RateLimiting:WalletPolicy:PermitLimit"] = "100000",
                ["RateLimiting:WalletPolicy:WindowSeconds"] = "1"
            });
        });

        builder.ConfigureTestServices(services =>
        {
            var descriptorsToRemove = services
                .Where(d =>
                {
                    var t = d.ServiceType;
                    if (t == typeof(DataContext)) return true;
                    if (t == typeof(DbContextOptions<DataContext>)) return true;
                    if (!t.IsGenericType) return false;
                    var args = t.GetGenericArguments();
                    return args.Length == 1 && args[0] == typeof(DataContext);
                })
                .ToList();
            foreach (var d in descriptorsToRemove)
                services.Remove(d);

            services.AddDbContext<DataContext>(opts =>
            {
                opts.UseNpgsql(ConnectionString, npg =>
                {
                    npg.MigrationsHistoryTable(DIExtension.MigrationsHistoryTable, DIExtension.SchemaName);
                    npg.MigrationsAssembly(typeof(DataContext).Assembly.FullName);
                });
                opts.UseSnakeCaseNamingConvention();
                opts.AddInterceptors(new AuditingInterceptor());
            });

            services.AddAuthentication(TestAuthHandler.SchemeName)
                .AddScheme<TestAuthOptions, TestAuthHandler>(TestAuthHandler.SchemeName, _ => { });
        });

        builder.UseEnvironment("Testing");
    }

    public HttpClient CreateAuthenticatedClient(
        string uid,
        string email = "test@example.com",
        string? displayName = null)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UidHeader, uid);
        client.DefaultRequestHeaders.Add(TestAuthHandler.EmailHeader, email);
        if (!string.IsNullOrEmpty(displayName))
            client.DefaultRequestHeaders.Add(TestAuthHandler.DisplayNameHeader, displayName);
        return client;
    }
}
