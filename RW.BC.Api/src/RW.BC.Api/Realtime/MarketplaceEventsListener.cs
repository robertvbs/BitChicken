using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.SignalR;
using Npgsql;
using RW.BC.Api.Hubs;
using RW.BC.Infrastructure.Persistence._Extensions;

namespace RW.BC.Api.Realtime;

[ExcludeFromCodeCoverage]
internal sealed class MarketplaceEventsListener(
    IConfiguration configuration,
    IHubContext<EventsHub> hub,
    IListingsChangeDetector detector,
    IForgeFulfillmentDetector forgeDetector,
    ILogger<MarketplaceEventsListener> logger)
    : BackgroundService
{
    private const string Channel = "indexer_live_query";
    private static readonly TimeSpan FallbackInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan RetryDelay = TimeSpan.FromSeconds(5);

    private ListingsSnapshot? _last;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await RunListenLoopAsync(ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "MarketplaceEventsListener connection lost; reconnecting in {Delay}s", RetryDelay.TotalSeconds);
                await Task.Delay(RetryDelay, ct);
            }
        }
    }

    private async Task RunListenLoopAsync(CancellationToken ct)
    {
        var connectionString = configuration.GetConnectionString(DIExtension.ConnectionStringName)
            ?? throw new InvalidOperationException($"ConnectionStrings:{DIExtension.ConnectionStringName} not configured.");

        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync(ct);

        await forgeDetector.SeedCursorAsync(connection, ct);

        await using (var listenCmd = connection.CreateCommand())
        {
            listenCmd.CommandText = $"LISTEN {Channel}";
            await listenCmd.ExecuteNonQueryAsync(ct);
        }

        while (!ct.IsCancellationRequested)
        {
            try
            {
                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                timeoutCts.CancelAfter(FallbackInterval);

                try
                {
                    await connection.WaitAsync(timeoutCts.Token);
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                }

                await CheckAndNotifyAsync(connection, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error in MarketplaceEventsListener cycle; restarting connection");
                throw;
            }
        }
    }

    private async Task CheckAndNotifyAsync(NpgsqlConnection connection, CancellationToken ct)
    {
        try
        {
            await CheckMarketAsync(connection, ct);
            await CheckForgeAsync(connection, ct);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error checking/notifying events");
        }
    }

    private async Task CheckMarketAsync(NpgsqlConnection connection, CancellationToken ct)
    {
        var current = await detector.TryReadSnapshotAsync(connection, ct);

        if (!detector.HasChanged(_last, current))
            return;

        _last = current;

        var notification = new MarketChangedNotification(current!.Value.Count, current.Value.MaxBlock);
        await hub.Clients.All.SendAsync("marketChanged", notification, ct);

        logger.LogInformation(
            "marketChanged pushed: count={Count} maxBlock={MaxBlock}",
            current.Value.Count, current.Value.MaxBlock);
    }

    private async Task CheckForgeAsync(NpgsqlConnection connection, CancellationToken ct)
    {
        var fulfillments = await forgeDetector.GetNewFulfillmentsAsync(connection, ct);

        foreach (var ev in fulfillments)
        {
            var notification = new ForgeFulfilledNotification(ev.RequestId, ev.TokenId, ev.EditionId);
            await hub.Clients.Group(ev.Buyer).SendAsync("forgeFulfilled", notification, ct);

            logger.LogInformation(
                "forgeFulfilled pushed: requestId={RequestId} buyer={Buyer}",
                ev.RequestId, ev.Buyer);
        }
    }
}
