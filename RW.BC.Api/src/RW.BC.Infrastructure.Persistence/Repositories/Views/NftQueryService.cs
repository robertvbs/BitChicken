using Gridify;
using Microsoft.EntityFrameworkCore;
using RW.BC.Application._Querying;
using RW.BC.Application.Nfts.Dtos;
using RW.BC.Application.Nfts.Ports;
using RW.BC.Application.Nfts.Queries.GetAccountNfts;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class NftQueryService(DataContext context) : INftQueryService
{
    public Task<PagedResponse<NftItemDto>> QueryByOwnerAsync(
        string ownerAddress,
        IGridifyMapper<EnrichedNftRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken)
    {
        var query =
            from n in context.Set<NftToken>().AsNoTracking()
            where n.Owner == ownerAddress && !n.Burned
            join e in context.Set<Edition>().AsNoTracking() on n.EditionId equals e.EditionId
            select new EnrichedNftRow
            {
                TokenId = n.TokenId,
                EditionId = n.EditionId,
                EditionName = e.Name,
                ArtUri = e.ArtUri,
                NftName = n.NftName,
                Rarity = e.Rarity,
                Health = e.Health,
                Skill = e.Skill,
                Morale = e.Morale,
                Gender = n.Gender,
                Staked = n.Staked
            };

        return query.ToPagedResponseAsync(
            mapper,
            request,
            r => new NftItemDto(
                r.TokenId.ToString(),
                new NftAttributesDto(r.Health, r.Skill, r.Morale, r.Gender),
                r.EditionId.ToString(),
                r.EditionName,
                r.ArtUri,
                r.Rarity,
                r.NftName,
                r.Staked),
            cancellationToken);
    }
}
