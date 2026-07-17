using Npgsql;

namespace RW.BC.Api.Realtime;

internal interface IForgeFulfillmentDetector
{
    long LastFulfilledAtBlock { get; }

    Task SeedCursorAsync(NpgsqlConnection connection, CancellationToken ct);

    Task<IReadOnlyList<FulfilledForgeEvent>> GetNewFulfillmentsAsync(
        NpgsqlConnection connection,
        CancellationToken ct);
}
