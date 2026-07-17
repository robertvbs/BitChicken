using System.Numerics;

namespace RW.BC.Application.Forge.Queries.GetAccountForgeRequests;

public sealed class ForgeRequestRow
{
    public BigInteger RequestId { get; init; }
    public int Tier { get; init; }
    public string Status { get; init; } = string.Empty;
    public BigInteger? TokenId { get; init; }
    public BigInteger? EditionId { get; init; }
    public BigInteger BlockNumber { get; init; }
}
