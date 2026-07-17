namespace RW.BC.Application.Nfts.Dtos;

public sealed record NftAttributesDto(int Health, int Skill, int Morale, int Gender);

public sealed record NftItemDto(
    string TokenId,
    NftAttributesDto Attributes,
    string EditionId,
    string EditionName,
    string ArtUri,
    int Rarity,
    string NftName,
    bool Staked);
