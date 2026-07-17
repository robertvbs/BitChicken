using Microsoft.Extensions.Caching.Memory;
using RW.BC.Application.Transparency.Dtos;
using RW.BC.Application.Transparency.Ports;

namespace RW.BC.Application.Transparency.Queries.GetSummary;

public sealed class GetSummaryHandler(ITransparencySummaryQueryService store, IMemoryCache cache)
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);
    private const string CacheKey = "transparency:summary";

    public async Task<TransparencySummaryDto> Handle(
        GetSummaryQuery query,
        CancellationToken cancellationToken)
    {
        return await cache.GetOrCreateAsync(CacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheTtl;

            var salesCount = await store.GetSalesCountAsync(CancellationToken.None);
            var totalVolume = await store.GetTotalVolumeAsync(CancellationToken.None);
            var nftCount = await store.GetNftCountAsync(CancellationToken.None);
            var editionCount = await store.GetEditionCountAsync(CancellationToken.None);
            var totalBckn = await store.GetTotalBcknTransferredAsync(CancellationToken.None);

            return new TransparencySummaryDto(salesCount, totalVolume, nftCount, editionCount, totalBckn);
        }) ?? new TransparencySummaryDto(0, "0", 0, 0, "0");
    }
}
