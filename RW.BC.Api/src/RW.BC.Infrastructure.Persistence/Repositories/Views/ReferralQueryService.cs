using Microsoft.EntityFrameworkCore;
using Npgsql;
using RW.BC.Application.Referral.Ports;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class ReferralQueryService(DataContext context) : IReferralQueryService
{
    public async Task<string?> GetRegistrationCodeAsync(string address, CancellationToken cancellationToken)
    {
        var reg = await context.Set<ReferralRegistration>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Referrer == address, cancellationToken);

        return reg is null ? null : reg.Code.ToString();
    }

    public async Task<string?> GetUplineAsync(string address, CancellationToken cancellationToken)
    {
        var link = await context.Set<ReferralLink>()
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Buyer == address, cancellationToken);

        return link?.Referrer;
    }

    public async Task<long> GetReferralCountAsync(string address, CancellationToken cancellationToken) =>
        await context.Set<ReferralLink>()
            .AsNoTracking()
            .LongCountAsync(r => r.Referrer == address, cancellationToken);

    public Task<string> GetTotalAccruedAsync(string address, CancellationToken cancellationToken) =>
        ExecuteScalarTextAsync(
            "SELECT COALESCE(SUM(amount), 0)::text FROM indexer.referral_bnb_accruals WHERE referrer = $1",
            address,
            cancellationToken);

    public Task<string> GetTotalClaimedAsync(string address, CancellationToken cancellationToken) =>
        ExecuteScalarTextAsync(
            "SELECT COALESCE(SUM(amount), 0)::text FROM indexer.referral_bnb_claims WHERE referrer = $1",
            address,
            cancellationToken);

    private async Task<string> ExecuteScalarTextAsync(string sql, string param, CancellationToken cancellationToken)
    {
        await context.Database.OpenConnectionAsync(cancellationToken);
        try
        {
            var conn = (NpgsqlConnection)context.Database.GetDbConnection();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = sql;
            cmd.Parameters.AddWithValue(param);
            var result = await cmd.ExecuteScalarAsync(cancellationToken);
            return (string)result!;
        }
        finally
        {
            await context.Database.CloseConnectionAsync();
        }
    }
}
