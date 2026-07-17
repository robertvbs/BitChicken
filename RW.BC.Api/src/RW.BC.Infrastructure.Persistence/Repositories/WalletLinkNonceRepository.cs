using Microsoft.EntityFrameworkCore;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Domain.Accounts;

namespace RW.BC.Infrastructure.Persistence.Repositories;

public sealed class WalletLinkNonceRepository(DataContext context) : IWalletLinkNonceRepository
{
    public Task<WalletLinkNonce?> GetByAccountIdAsync(string accountId, CancellationToken cancellationToken = default)
    {
        return context.Set<WalletLinkNonce>().FirstOrDefaultAsync(n => n.Id == accountId, cancellationToken);
    }

    public async Task AddAsync(WalletLinkNonce nonce, CancellationToken cancellationToken = default)
    {
        await context.Set<WalletLinkNonce>().AddAsync(nonce, cancellationToken);
    }

    public void Update(WalletLinkNonce nonce)
    {
        context.Set<WalletLinkNonce>().Update(nonce);
    }

    public void Remove(WalletLinkNonce nonce)
    {
        context.Set<WalletLinkNonce>().Remove(nonce);
    }
}
