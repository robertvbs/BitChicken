using System.Reflection;
using Microsoft.EntityFrameworkCore;
using RW.BC.Application.Abstractions;

namespace RW.BC.Infrastructure.Persistence;

public sealed class DataContext(DbContextOptions<DataContext> options) : DbContext(options), IUnitOfWork
{
    public async Task CommitAsync(CancellationToken cancellationToken = default)
    {
        await this.SaveChangesMappingExceptionsAsync(cancellationToken);
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        base.OnModelCreating(modelBuilder);
    }
}
