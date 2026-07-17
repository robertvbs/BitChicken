using System.Numerics;

namespace RW.BC.Application.Transparency.Queries.GetSales;

public sealed class SaleRow
{
    public BigInteger TokenId { get; init; }
    public string Seller { get; init; } = string.Empty;
    public string Buyer { get; init; } = string.Empty;
    public BigInteger Price { get; init; }
    public BigInteger PlatformFee { get; init; }
    public BigInteger Royalty { get; init; }
    public long BlockNumber { get; init; }
}
