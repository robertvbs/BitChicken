using Microsoft.Extensions.Logging;
using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Domain.Accounts;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Application.Accounts.Commands.EnsureAccountProvisioned;

public sealed partial class EnsureAccountProvisionedHandler(
    IAccountRepository accountRepository,
    IUnitOfWork unitOfWork,
    ILogger<EnsureAccountProvisionedHandler> logger)
{
    private const string EmailConstraintName = "ix_accounts_email";

    public async Task Handle(EnsureAccountProvisionedCommand request, CancellationToken cancellationToken)
    {
        if (await accountRepository.ExistsByIdAsync(request.Uid, cancellationToken))
            return;

        if (await accountRepository.ExistsByEmailAsync(request.Email, cancellationToken))
            throw new ConflictException(
                "An account with this email is already registered under a different identity.",
                EmailConstraintName);

        var email = Email.Create(request.Email);
        var nickname = ResolveNickname(request.DisplayName, request.Email);
        var account = Account.Create(request.Uid, email, nickname);

        try
        {
            await accountRepository.AddAsync(account, cancellationToken);
            await unitOfWork.CommitAsync(cancellationToken);
        }
        catch (ConflictException ex) when (ex.ConstraintName != EmailConstraintName)
        {
            logger.LogDebug(
                "Account {Uid} already exists (race condition on PK); provisioning is idempotent.",
                request.Uid);
        }
    }

    private static string ResolveNickname(string? displayName, string email)
    {
        if (!string.IsNullOrWhiteSpace(displayName))
        {
            var candidate = displayName.Trim();
            if (Account.IsValidNickname(candidate))
                return candidate;
        }

        return DeriveNicknameFromEmail(email);
    }

    private static string DeriveNicknameFromEmail(string email)
    {
        var local = email.Contains('@') ? email[..email.IndexOf('@')] : email;
        var sanitized = InvalidNicknameCharsRegex().Replace(local, "_");
        sanitized = sanitized.Trim('_');

        if (sanitized.Length < Account.NicknameMinLength)
            sanitized = sanitized.PadRight(Account.NicknameMinLength, '0');

        if (sanitized.Length > Account.NicknameMaxLength)
            sanitized = sanitized[..Account.NicknameMaxLength];

        return sanitized;
    }

    [System.Text.RegularExpressions.GeneratedRegex(@"[^A-Za-z0-9_]")]
    private static partial System.Text.RegularExpressions.Regex InvalidNicknameCharsRegex();
}
