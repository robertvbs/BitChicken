using RW.BC.Domain.Accounts;

namespace RW.BC.Application.Accounts.Ports;

public interface IAccountRepository
{
    Task AddAsync(Account account, CancellationToken cancellationToken = default);
    Task<Account?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<Account?> GetByIdNoTrackingAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> ExistsByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default);
    void Update(Account account);
}
