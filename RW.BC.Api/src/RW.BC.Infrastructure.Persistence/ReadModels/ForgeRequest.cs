using System.Numerics;

namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class ForgeRequest
{
    public BigInteger RequestId { get; init; }
    public string Buyer { get; init; } = string.Empty;
    public int Tier { get; init; }
    public string Status { get; init; } = string.Empty;
    public BigInteger? TokenId { get; init; }
    public BigInteger? EditionId { get; init; }
    public BigInteger BlockNumber { get; init; }
    public BigInteger? FulfilledAtBlock { get; init; }
}
