using System.Numerics;

namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class StakingPair
{
    public BigInteger PairId { get; init; }
    public string Staker { get; init; } = string.Empty;
    public BigInteger MaleId { get; init; }
    public BigInteger FemaleId { get; init; }
    public bool Matched { get; init; }
    public BigInteger StakedAt { get; init; }
    public BigInteger LastClaimAt { get; init; }
    public string Status { get; init; } = string.Empty;
}
