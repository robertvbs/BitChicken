using Npgsql;

namespace RW.BC.Api.Realtime;

internal sealed class ListingsChangeDetector : IListingsChangeDetector
{
    private const string TableMissingCode = "42P01";

    private const string SnapshotSql =
        "SELECT count(*), COALESCE(max(updated_at_block), 0)::bigint FROM indexer.listings";

    public async Task<ListingsSnapshot?> TryReadSnapshotAsync(
        NpgsqlConnection connection,
        CancellationToken ct)
    {
        await using var cmd = connection.CreateCommand();
        cmd.CommandText = SnapshotSql;

        try
        {
            await using var reader = await cmd.ExecuteReaderAsync(ct);
            await reader.ReadAsync(ct);

            var count = reader.GetInt64(0);
            var maxBlock = reader.GetInt64(1);
            return new ListingsSnapshot(count, maxBlock);
        }
        catch (PostgresException ex) when (ex.SqlState == TableMissingCode)
        {
            return null;
        }
    }

    public bool HasChanged(ListingsSnapshot? previous, ListingsSnapshot? current) =>
        current is not null && current != previous;
}
