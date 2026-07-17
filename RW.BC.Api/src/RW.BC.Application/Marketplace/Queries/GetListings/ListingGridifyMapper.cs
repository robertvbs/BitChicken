using Gridify;

namespace RW.BC.Application.Marketplace.Queries.GetListings;

public sealed class ListingGridifyMapper : GridifyMapper<EnrichedListingRow>
{
    public ListingGridifyMapper()
    {
        AddMap("tokenId", r => r.TokenId);
        AddMap("seller", r => r.Seller);
        AddMap("price", r => r.Price);
        AddMap("status", r => r.Status);
        AddMap("editionId", r => r.EditionId);
        AddMap("editionName", r => r.EditionName);
        AddMap("rarity", r => r.Rarity);
        AddMap("gender", r => r.Gender);
        AddMap("listedAtBlock", r => r.ListedAtBlock);
    }
}
