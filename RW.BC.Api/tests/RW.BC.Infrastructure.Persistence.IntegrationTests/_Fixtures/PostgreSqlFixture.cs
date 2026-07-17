using Microsoft.EntityFrameworkCore;
using RW.BC.Infrastructure.Persistence._Extensions;
using Testcontainers.PostgreSql;

namespace RW.BC.Infrastructure.Persistence.IntegrationTests._Fixtures;

public sealed class PostgreSqlFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17.6")
        .WithDatabase("bitchicken_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        await using var ctx = NewDbContext();
        await ctx.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        await _container.DisposeAsync();
    }

    public DataContext NewDbContext()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseNpgsql(_container.GetConnectionString(), npg =>
            {
                npg.MigrationsHistoryTable(DIExtension.MigrationsHistoryTable, DIExtension.SchemaName);
                npg.MigrationsAssembly(typeof(DataContext).Assembly.FullName);
            })
            .UseSnakeCaseNamingConvention()
            .AddInterceptors(new AuditingInterceptor())
            .Options;

        return new DataContext(options);
    }
}
