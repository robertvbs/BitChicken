using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Dtos;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Domain.Accounts;

namespace RW.BC.Application.Accounts.Queries.GetMyAccount;

public sealed class GetMyAccountHandler(IAccountRepository accountRepository)
{
    public async Task<AccountDto> Handle(GetMyAccountQuery request, CancellationToken cancellationToken)
    {
        var account = await accountRepository.GetByIdNoTrackingAsync(request.UserId, cancellationToken)
                      ?? throw new NotFoundException(nameof(Account), request.UserId);

        return new AccountDto(
            account.Id,
            account.Email.Value,
            account.Nickname,
            (AccountStatusDto)(byte)account.Status,
            account.WalletAddress,
            account.WalletLinked);
    }
}
