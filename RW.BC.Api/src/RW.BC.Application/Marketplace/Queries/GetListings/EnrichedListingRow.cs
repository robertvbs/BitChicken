using System.Numerics;

namespace RW.BC.Application.Marketplace.Queries.GetListings;

public sealed class EnrichedListingRow
{
    public BigInteger TokenId { get; init; }
    public string Seller { get; init; } = string.Empty;
    public BigInteger Price { get; init; }
    public string Status { get; init; } = string.Empty;
    public BigInteger EditionId { get; init; }
    public long ListedAtBlock { get; init; }
    public int Gender { get; init; }
    public string NftName { get; init; } = string.Empty;
    public string EditionName { get; init; } = string.Empty;
    public string ArtUri { get; init; } = string.Empty;
    public int Rarity { get; init; }
    public int Health { get; init; }
    public int Skill { get; init; }
    public int Morale { get; init; }
}
