using RW.BC.Domain.Accounts;

namespace RW.BC.Application.Accounts.Ports;

public interface IWalletLinkNonceRepository
{
    Task<WalletLinkNonce?> GetByAccountIdAsync(string accountId, CancellationToken cancellationToken = default);
    Task AddAsync(WalletLinkNonce nonce, CancellationToken cancellationToken = default);
    void Update(WalletLinkNonce nonce);
    void Remove(WalletLinkNonce nonce);
}
