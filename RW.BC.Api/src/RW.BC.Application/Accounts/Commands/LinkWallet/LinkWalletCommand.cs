namespace RW.BC.Application.Accounts.Commands.LinkWallet;

public sealed record LinkWalletCommand(
    string AccountId,
    string Address,
    string Signature);
