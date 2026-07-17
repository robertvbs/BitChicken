using System.Numerics;

namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class MarketplaceListing
{
    public BigInteger TokenId { get; init; }
    public string Seller { get; init; } = string.Empty;
    public BigInteger Price { get; init; }
    public string Status { get; init; } = string.Empty;
    public long ListedAtBlock { get; init; }
}
