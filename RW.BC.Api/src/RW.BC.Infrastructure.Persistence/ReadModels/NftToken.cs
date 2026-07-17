using System.Numerics;

namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class NftToken
{
    public BigInteger TokenId { get; init; }
    public BigInteger EditionId { get; init; }
    public string Owner { get; init; } = string.Empty;
    public string NftName { get; init; } = string.Empty;
    public int Gender { get; init; }
    public bool Staked { get; init; }
    public bool Burned { get; init; }
}
