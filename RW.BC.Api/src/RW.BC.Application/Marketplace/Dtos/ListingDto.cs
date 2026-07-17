namespace RW.BC.Application.Marketplace.Dtos;

public sealed record ListingAttributesDto(int Health, int Skill, int Morale);

public sealed record ListingDto(
    string TokenId,
    string Seller,
    string Price,
    string Status,
    string EditionId,
    string EditionName,
    string ArtUri,
    int Rarity,
    int Gender,
    string NftName,
    ListingAttributesDto Attributes);
