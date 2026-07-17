using Gridify;

namespace RW.BC.Application.Nfts.Queries.GetAccountNfts;

public sealed class NftGridifyMapper : GridifyMapper<EnrichedNftRow>
{
    public NftGridifyMapper()
    {
        AddMap("tokenId", r => r.TokenId);
        AddMap("editionId", r => r.EditionId);
        AddMap("editionName", r => r.EditionName);
        AddMap("rarity", r => r.Rarity);
        AddMap("gender", r => r.Gender);
        AddMap("staked", r => r.Staked);
    }
}
