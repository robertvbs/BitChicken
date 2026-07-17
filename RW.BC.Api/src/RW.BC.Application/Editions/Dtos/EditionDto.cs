namespace RW.BC.Application.Editions.Dtos;

public sealed record EditionDto(
    string Id,
    string Name,
    string ArtUri,
    int Health,
    int Skill,
    int Morale,
    int Rarity,
    string MaxSupply,
    string Minted,
    string MintStart,
    string MintEnd,
    string Price,
    int Distribution,
    bool Active);
