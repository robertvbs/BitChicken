namespace RW.BC.Application.Transparency.Dtos;

public sealed record TransparencySummaryDto(
    long SalesCount,
    string TotalVolume,
    long NftCount,
    long EditionCount,
    string TotalBcknTransferred);
