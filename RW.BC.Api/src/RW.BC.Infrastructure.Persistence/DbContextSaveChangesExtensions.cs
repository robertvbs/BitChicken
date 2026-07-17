using Microsoft.EntityFrameworkCore;
using Npgsql;
using RW.BC.Application.Abstractions;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Infrastructure.Persistence;

public static class DbContextSaveChangesExtensions
{
    private const string UniqueViolationSqlState = "23505";

    public static async Task<int> SaveChangesMappingExceptionsAsync(
        this DbContext context,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);

        try
        {
            return await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: UniqueViolationSqlState } pg)
        {
            throw new ConflictException(
                "The record already exists in the system. Check for duplicate data.",
                pg.ConstraintName);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new DomainException("The record was modified by another user. Please reload and try again.", ex);
        }
        catch (DbUpdateException ex)
        {
            throw new InfrastructureException("An error occurred while saving to the database.", ex);
        }
    }
}
