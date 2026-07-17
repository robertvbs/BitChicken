using Microsoft.EntityFrameworkCore;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Domain.Accounts;

namespace RW.BC.Infrastructure.Persistence.Repositories;

public sealed class AccountRepository(DataContext context) : IAccountRepository
{
    public async Task AddAsync(Account account, CancellationToken cancellationToken = default)
    {
        await context.Set<Account>().AddAsync(account, cancellationToken);
    }

    public Task<Account?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        return context.Set<Account>().FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }

    public Task<Account?> GetByIdNoTrackingAsync(string id, CancellationToken cancellationToken = default)
    {
        return context.Set<Account>().AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }

    public Task<bool> ExistsByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        return context.Set<Account>().AsNoTracking().AnyAsync(a => a.Id == id, cancellationToken);
    }

    public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return context.Set<Account>().AsNoTracking().AnyAsync(a => a.Email.Value == email, cancellationToken);
    }

    public void Update(Account account)
    {
        context.Set<Account>().Update(account);
    }
}
