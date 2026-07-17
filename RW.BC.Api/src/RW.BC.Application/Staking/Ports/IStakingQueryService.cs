using Gridify;
using RW.BC.Application._Querying;
using RW.BC.Application.Staking.Dtos;
using RW.BC.Application.Staking.Queries.GetAccountStaking;

namespace RW.BC.Application.Staking.Ports;

public interface IStakingQueryService
{
    Task<PagedResponse<StakingPairDto>> QueryActiveAsync(
        string stakerAddress,
        IGridifyMapper<StakingPairRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken);
}
