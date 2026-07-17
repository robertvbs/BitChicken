namespace RW.BC.Application.Accounts.Commands.EnsureAccountProvisioned;

public sealed record EnsureAccountProvisionedCommand(
    string Uid,
    string Email,
    string? DisplayName);
