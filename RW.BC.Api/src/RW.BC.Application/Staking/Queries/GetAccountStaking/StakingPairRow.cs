using System.Numerics;

namespace RW.BC.Application.Staking.Queries.GetAccountStaking;

public sealed class StakingPairRow
{
    public BigInteger PairId { get; init; }
    public BigInteger MaleId { get; init; }
    public BigInteger FemaleId { get; init; }
    public bool Matched { get; init; }
    public BigInteger StakedAt { get; init; }
    public BigInteger LastClaimAt { get; init; }
    public string Status { get; init; } = string.Empty;
}
