namespace RW.BC.Application.Transparency.Dtos;

public sealed record SaleDto(
    string TokenId,
    string Seller,
    string Buyer,
    string Price,
    string PlatformFee,
    string Royalty,
    long BlockNumber);
