using Microsoft.EntityFrameworkCore;
using Npgsql;
using RW.BC.Application.Transparency.Ports;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class TransparencySummaryQueryService(DataContext context) : ITransparencySummaryQueryService
{
    public async Task<long> GetSalesCountAsync(CancellationToken cancellationToken) =>
        await context.Set<Sale>().AsNoTracking().LongCountAsync(cancellationToken);

    public Task<string> GetTotalVolumeAsync(CancellationToken cancellationToken) =>
        ExecuteScalarTextAsync("SELECT COALESCE(SUM(price), 0)::text FROM indexer.sales", cancellationToken);

    public async Task<long> GetNftCountAsync(CancellationToken cancellationToken) =>
        await context.Set<NftToken>().AsNoTracking().LongCountAsync(n => !n.Burned, cancellationToken);

    public async Task<long> GetEditionCountAsync(CancellationToken cancellationToken) =>
        await context.Set<Edition>().AsNoTracking().LongCountAsync(cancellationToken);

    public Task<string> GetTotalBcknTransferredAsync(CancellationToken cancellationToken) =>
        ExecuteScalarTextAsync("SELECT COALESCE(SUM(value), 0)::text FROM indexer.token_transfers", cancellationToken);

    private async Task<string> ExecuteScalarTextAsync(string sql, CancellationToken cancellationToken)
    {
        await context.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var conn = (NpgsqlConnection)context.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            return (string)result!;
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }
}
