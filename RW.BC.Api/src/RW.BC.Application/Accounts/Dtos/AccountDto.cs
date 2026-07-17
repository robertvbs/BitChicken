namespace RW.BC.Application.Accounts.Dtos;

public sealed record AccountDto(
    string Id,
    string Email,
    string Nickname,
    AccountStatusDto Status,
    string? WalletAddress,
    bool WalletLinked);
