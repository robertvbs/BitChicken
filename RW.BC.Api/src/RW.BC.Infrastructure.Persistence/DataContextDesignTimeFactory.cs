using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RW.BC.Infrastructure.Persistence;

[ExcludeFromCodeCoverage]
public sealed class DataContextDesignTimeFactory : IDesignTimeDbContextFactory<DataContext>
{
    private const string LocalDevConnectionString =
        "Host=localhost;Port=5432;Database=bitchicken;Username=postgres;Password=postgres";

    public DataContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__bitchicken")
            ?? LocalDevConnectionString;
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseNpgsql(connectionString,
                npg => npg.MigrationsHistoryTable(_Extensions.DIExtension.MigrationsHistoryTable, _Extensions.DIExtension.SchemaName))
            .UseSnakeCaseNamingConvention()
            .Options;
        return new DataContext(options);
    }
}
