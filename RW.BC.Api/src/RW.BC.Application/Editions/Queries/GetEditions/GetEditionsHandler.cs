using Gridify;
using Microsoft.Extensions.Caching.Memory;
using RW.BC.Application._Querying;
using RW.BC.Application.Editions.Dtos;
using RW.BC.Application.Editions.Ports;

namespace RW.BC.Application.Editions.Queries.GetEditions;

public sealed class GetEditionsHandler(
    IEditionQueryService store,
    EditionGridifyMapper mapper,
    IMemoryCache cache)
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(60);
    private const string CacheKey = "editions:all";

    public async Task<PagedResponse<EditionDto>> Handle(
        GetEditionsQuery query,
        CancellationToken cancellationToken)
    {
        var all = await cache.GetOrCreateAsync(CacheKey, async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = CacheTtl;
            return await store.GetAllAsync(CancellationToken.None);
        });

        var source = (all ?? []).AsQueryable();

        var gridifyQuery = new GridifyQuery
        {
            Filter = string.IsNullOrWhiteSpace(query.Request.Filter) ? null : query.Request.Filter,
            OrderBy = string.IsNullOrWhiteSpace(query.Request.OrderBy) ? null : query.Request.OrderBy,
            Page = query.Request.Page,
            PageSize = query.Request.PageSize
        };

        var filteredList = source.ApplyFiltering(gridifyQuery, mapper).ToList();
        var count = filteredList.Count;
        if (count == 0)
            return new PagedResponse<EditionDto>([], 0, query.Request.Page, query.Request.PageSize);

        var paged = filteredList.AsQueryable()
            .ApplyOrdering(gridifyQuery, mapper)
            .ApplyPaging(gridifyQuery)
            .Select(r => new EditionDto(
                r.EditionId.ToString(),
                r.Name,
                r.ArtUri,
                r.Health,
                r.Skill,
                r.Morale,
                r.Rarity,
                r.MaxSupply.ToString(),
                r.Minted.ToString(),
                r.MintStart.ToString(),
                r.MintEnd.ToString(),
                r.Price.ToString(),
                r.Distribution,
                r.Active))
            .ToList();

        return new PagedResponse<EditionDto>(paged, count, query.Request.Page, query.Request.PageSize);
    }
}
