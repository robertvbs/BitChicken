using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Dtos;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Domain.Accounts;

namespace RW.BC.Application.Accounts.Commands.UnlinkWallet;

public sealed class UnlinkWalletHandler(
    IAccountRepository accountRepository,
    IUnitOfWork unitOfWork)
{
    public async Task<AccountDto> Handle(UnlinkWalletCommand request, CancellationToken cancellationToken)
    {
        var account = await accountRepository.GetByIdAsync(request.AccountId, cancellationToken)
                      ?? throw new NotFoundException(nameof(Account), request.AccountId);

        account.UnlinkWallet();
        accountRepository.Update(account);

        await unitOfWork.CommitAsync(cancellationToken);

        return new AccountDto(
            account.Id,
            account.Email.Value,
            account.Nickname,
            (AccountStatusDto)(byte)account.Status,
            account.WalletAddress,
            account.WalletLinked);
    }
}
