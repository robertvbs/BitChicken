namespace RW.BC.Application.Accounts.Dtos;

public sealed record LinkWalletRequest(
    string Address,
    string Signature);
