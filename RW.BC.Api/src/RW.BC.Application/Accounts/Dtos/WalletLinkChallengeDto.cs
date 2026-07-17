namespace RW.BC.Application.Accounts.Dtos;

public sealed record WalletLinkChallengeDto(
    string Message,
    string Nonce,
    DateTimeOffset ExpiresAt);
