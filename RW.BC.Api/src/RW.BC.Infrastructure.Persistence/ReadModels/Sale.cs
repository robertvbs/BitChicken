using System.Numerics;

namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class Sale
{
    public string Id { get; init; } = string.Empty;
    public BigInteger TokenId { get; init; }
    public string Seller { get; init; } = string.Empty;
    public string Buyer { get; init; } = string.Empty;
    public BigInteger Price { get; init; }
    public BigInteger PlatformFee { get; init; }
    public BigInteger Royalty { get; init; }
    public long BlockNumber { get; init; }
}
