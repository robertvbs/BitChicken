using System.Numerics;

namespace RW.BC.Application.Nfts.Queries.GetAccountNfts;

public sealed class EnrichedNftRow
{
    public BigInteger TokenId { get; init; }
    public BigInteger EditionId { get; init; }
    public string EditionName { get; init; } = string.Empty;
    public string ArtUri { get; init; } = string.Empty;
    public string NftName { get; init; } = string.Empty;
    public int Rarity { get; init; }
    public int Health { get; init; }
    public int Skill { get; init; }
    public int Morale { get; init; }
    public int Gender { get; init; }
    public bool Staked { get; init; }
}
