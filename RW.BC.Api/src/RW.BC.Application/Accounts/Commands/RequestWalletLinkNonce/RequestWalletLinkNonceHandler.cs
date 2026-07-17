using System.Security.Cryptography;
using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Dtos;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Application.Accounts.WalletLink;
using RW.BC.Domain.Accounts;

namespace RW.BC.Application.Accounts.Commands.RequestWalletLinkNonce;

public sealed class RequestWalletLinkNonceHandler(
    IAccountRepository accountRepository,
    IWalletLinkNonceRepository nonceRepository,
    IUnitOfWork unitOfWork)
{
    public static readonly TimeSpan Ttl = TimeSpan.FromMinutes(5);

    public async Task<WalletLinkChallengeDto> Handle(
        RequestWalletLinkNonceCommand request,
        CancellationToken cancellationToken)
    {
        var account = await accountRepository.GetByIdAsync(request.AccountId, cancellationToken)
                      ?? throw new NotFoundException(nameof(Account), request.AccountId);

        if (account.WalletLinked)
            throw new WalletAlreadyLinkedException(
                "A wallet is already linked to this account. Unlink it before requesting a new challenge.");

        var existing = await nonceRepository.GetByAccountIdAsync(account.Id, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        if (existing is not null && !existing.IsExpired(now))
            return new WalletLinkChallengeDto(existing.Message, existing.Nonce, existing.ExpiresAt);

        var expiresAt = now.Add(Ttl);
        var nonce = GenerateNonce();
        var message = WalletLinkMessageBuilder.Build(account.Id, nonce, now);

        if (existing is null)
        {
            await nonceRepository.AddAsync(
                WalletLinkNonce.Issue(account.Id, nonce, message, expiresAt), cancellationToken);
        }
        else
        {
            existing.Refresh(nonce, message, expiresAt);
            nonceRepository.Update(existing);
        }

        await unitOfWork.CommitAsync(cancellationToken);

        return new WalletLinkChallengeDto(message, nonce, expiresAt);
    }

    private static string GenerateNonce()
    {
        var bytes = RandomNumberGenerator.GetBytes(16);
        return Convert.ToHexStringLower(bytes);
    }
}
