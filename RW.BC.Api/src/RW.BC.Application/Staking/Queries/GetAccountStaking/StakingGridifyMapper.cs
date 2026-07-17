using Gridify;

namespace RW.BC.Application.Staking.Queries.GetAccountStaking;

public sealed class StakingGridifyMapper : GridifyMapper<StakingPairRow>
{
    public StakingGridifyMapper()
    {
        AddMap("status", p => p.Status);
        AddMap("matched", p => p.Matched);
        AddMap("pairId", p => p.PairId);
        AddMap("stakedAt", p => p.StakedAt);
        AddMap("lastClaimAt", p => p.LastClaimAt);
    }
}
