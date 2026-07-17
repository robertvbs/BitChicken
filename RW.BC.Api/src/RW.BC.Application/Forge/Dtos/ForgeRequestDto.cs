namespace RW.BC.Application.Forge.Dtos;

public sealed record ForgeRequestDto(
    string RequestId,
    int Tier,
    string Status,
    string? TokenId,
    string? EditionId,
    string BlockNumber);
