using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Dtos;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Application.Accounts.WalletLink;
using RW.BC.Domain.Accounts;

namespace RW.BC.Application.Accounts.Commands.LinkWallet;

public sealed class LinkWalletHandler(
    IAccountRepository accountRepository,
    IWalletLinkNonceRepository nonceRepository,
    ISignatureVerifier signatureVerifier,
    IUnitOfWork unitOfWork)
{
    public async Task<AccountDto> Handle(LinkWalletCommand request, CancellationToken cancellationToken)
    {
        var account = await accountRepository.GetByIdAsync(request.AccountId, cancellationToken)
                      ?? throw new NotFoundException(nameof(Account), request.AccountId);

        var challenge = await nonceRepository.GetByAccountIdAsync(account.Id, cancellationToken);
        if (challenge is null || challenge.IsExpired(DateTimeOffset.UtcNow))
            throw new WalletLinkNonceUnavailableException(
                "No active wallet-link challenge was found. Request a new nonce and try again.");

        var recovered = signatureVerifier.RecoverAddress(challenge.Message, request.Signature);
        if (!string.Equals(recovered, request.Address, StringComparison.OrdinalIgnoreCase))
            throw new WalletLinkSignatureInvalidException(
                "The signature does not match the provided wallet address.");

        account.LinkWallet(recovered);
        accountRepository.Update(account);
        nonceRepository.Remove(challenge);

        try
        {
            await unitOfWork.CommitAsync(cancellationToken);
        }
        catch (ConflictException)
        {
            throw new WalletAlreadyLinkedException(
                "This wallet address is already linked to another account.");
        }

        return new AccountDto(
            account.Id,
            account.Email.Value,
            account.Nickname,
            (AccountStatusDto)(byte)account.Status,
            account.WalletAddress,
            account.WalletLinked);
    }
}
