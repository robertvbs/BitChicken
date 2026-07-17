using RW.BC.Application._Querying;
using RW.BC.Application.Staking.Dtos;
using RW.BC.Application.Staking.Ports;

namespace RW.BC.Application.Staking.Queries.GetAccountStaking;

public sealed class GetAccountStakingHandler(IStakingQueryService store, StakingGridifyMapper mapper)
{
    private const string DefaultOrderBy = "stakedAt desc";

    public async Task<PagedResponse<StakingPairDto>> Handle(
        GetAccountStakingQuery query,
        CancellationToken cancellationToken)
    {
        var request = string.IsNullOrWhiteSpace(query.Request.OrderBy)
            ? query.Request with { OrderBy = DefaultOrderBy }
            : query.Request;

        return await store.QueryActiveAsync(
            query.Address.ToLowerInvariant(),
            mapper,
            request,
            cancellationToken);
    }
}
