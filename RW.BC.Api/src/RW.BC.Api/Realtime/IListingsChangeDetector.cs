using Npgsql;

namespace RW.BC.Api.Realtime;

internal interface IListingsChangeDetector
{
    Task<ListingsSnapshot?> TryReadSnapshotAsync(NpgsqlConnection connection, CancellationToken ct);
    bool HasChanged(ListingsSnapshot? previous, ListingsSnapshot? current);
}
