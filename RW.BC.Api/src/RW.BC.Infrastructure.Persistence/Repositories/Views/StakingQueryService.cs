using Gridify;
using Microsoft.EntityFrameworkCore;
using RW.BC.Application._Querying;
using RW.BC.Application.Staking.Dtos;
using RW.BC.Application.Staking.Ports;
using RW.BC.Application.Staking.Queries.GetAccountStaking;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class StakingQueryService(DataContext context) : IStakingQueryService
{
    public Task<PagedResponse<StakingPairDto>> QueryActiveAsync(
        string stakerAddress,
        IGridifyMapper<StakingPairRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken)
    {
        var query = context.Set<StakingPair>()
            .AsNoTracking()
            .Where(p => p.Staker == stakerAddress && p.Status == "Staked")
            .Select(p => new StakingPairRow
            {
                PairId = p.PairId,
                MaleId = p.MaleId,
                FemaleId = p.FemaleId,
                Matched = p.Matched,
                StakedAt = p.StakedAt,
                LastClaimAt = p.LastClaimAt,
                Status = p.Status
            });

        return query.ToPagedResponseAsync(
            mapper,
            request,
            p => new StakingPairDto(
                p.PairId.ToString(),
                p.MaleId.ToString(),
                p.FemaleId.ToString(),
                p.Matched,
                p.StakedAt.ToString(),
                p.LastClaimAt.ToString(),
                p.Status),
            cancellationToken);
    }
}
