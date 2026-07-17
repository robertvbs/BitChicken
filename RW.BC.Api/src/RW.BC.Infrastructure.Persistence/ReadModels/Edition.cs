using System.Numerics;

namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class Edition
{
    public BigInteger EditionId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ArtUri { get; init; } = string.Empty;
    public int Health { get; init; }
    public int Skill { get; init; }
    public int Morale { get; init; }
    public int Rarity { get; init; }
    public int Distribution { get; init; }
    public BigInteger MaxSupply { get; init; }
    public BigInteger Minted { get; init; }
    public BigInteger MintStart { get; init; }
    public BigInteger MintEnd { get; init; }
    public BigInteger Price { get; init; }
    public bool Active { get; init; }
}
