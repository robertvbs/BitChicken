using Gridify;
using Microsoft.EntityFrameworkCore;
using RW.BC.Application._Querying;
using RW.BC.Application.Marketplace.Dtos;
using RW.BC.Application.Marketplace.Ports;
using RW.BC.Application.Marketplace.Queries.GetListings;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class ListingQueryService(DataContext context) : IListingQueryService
{
    public Task<PagedResponse<ListingDto>> QueryActiveAsync(
        IGridifyMapper<EnrichedListingRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken)
    {
        var query =
            from l in context.Set<MarketplaceListing>().AsNoTracking()
            where l.Status == "Active"
            join n in context.Set<NftToken>().AsNoTracking() on l.TokenId equals n.TokenId into nftGroup
            from n in nftGroup.DefaultIfEmpty()
            join e in context.Set<Edition>().AsNoTracking() on n.EditionId equals e.EditionId into editionGroup
            from e in editionGroup.DefaultIfEmpty()
            select new EnrichedListingRow
            {
                TokenId = l.TokenId,
                Seller = l.Seller,
                Price = l.Price,
                Status = l.Status,
                EditionId = n != null ? n.EditionId : default,
                ListedAtBlock = l.ListedAtBlock,
                Gender = n != null ? n.Gender : 0,
                NftName = n != null ? n.NftName : string.Empty,
                EditionName = e != null ? e.Name : string.Empty,
                ArtUri = e != null ? e.ArtUri : string.Empty,
                Rarity = e != null ? e.Rarity : 0,
                Health = e != null ? e.Health : 0,
                Skill = e != null ? e.Skill : 0,
                Morale = e != null ? e.Morale : 0
            };

        return query.ToPagedResponseAsync(
            mapper,
            request,
            r => new ListingDto(
                r.TokenId.ToString(),
                r.Seller,
                r.Price.ToString(),
                r.Status,
                r.EditionId.ToString(),
                r.EditionName,
                r.ArtUri,
                r.Rarity,
                r.Gender,
                r.NftName,
                new ListingAttributesDto(r.Health, r.Skill, r.Morale)),
            cancellationToken);
    }
}
