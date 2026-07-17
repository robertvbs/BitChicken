using Npgsql;

namespace RW.BC.Api.Realtime;

internal sealed class ForgeFulfillmentDetector : IForgeFulfillmentDetector
{
    private const string TableMissingCode = "42P01";

    private const string SeedSql = """
        SELECT COALESCE(MAX(fulfilled_at_block), 0)::bigint
        FROM indexer.forge_requests
        WHERE status = 'Fulfilled'
        """;

    private const string QuerySql = """
        SELECT request_id, buyer, token_id, edition_id, fulfilled_at_block
        FROM indexer.forge_requests
        WHERE status = 'Fulfilled' AND fulfilled_at_block > @last
        ORDER BY fulfilled_at_block
        """;

    public long LastFulfilledAtBlock { get; private set; }

    public async Task SeedCursorAsync(NpgsqlConnection connection, CancellationToken ct)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = SeedSql;
        try
        {
            var result = await cmd.ExecuteScalarAsync(ct);
            LastFulfilledAtBlock = (long)result!;
        }
        catch (PostgresException ex) when (ex.SqlState == TableMissingCode)
        {
            LastFulfilledAtBlock = 0L;
        }
    }

    public async Task<IReadOnlyList<FulfilledForgeEvent>> GetNewFulfillmentsAsync(
        NpgsqlConnection connection,
        CancellationToken ct)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = QuerySql;
        cmd.Parameters.AddWithValue("last", LastFulfilledAtBlock);

        try
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);

            var results = new List<FulfilledForgeEvent>();
            var maxBlock = LastFulfilledAtBlock;

            while (await reader.ReadAsync(ct))
            {
                var requestId = reader.GetDecimal(0).ToString("0");
                var buyer = reader.GetString(1);
                var tokenId = reader.IsDBNull(2) ? string.Empty : reader.GetDecimal(2).ToString("0");
                var editionId = reader.IsDBNull(3) ? string.Empty : reader.GetDecimal(3).ToString("0");
                var fulfilledAtBlock = reader.GetInt64(4);

                if (fulfilledAtBlock > maxBlock)
                    maxBlock = fulfilledAtBlock;

                results.Add(new FulfilledForgeEvent(buyer, requestId, tokenId, editionId));
            }

            LastFulfilledAtBlock = maxBlock;
            return results;
        }
        catch (PostgresException ex) when (ex.SqlState == TableMissingCode)
        {
            return [];
        }
    }
}
