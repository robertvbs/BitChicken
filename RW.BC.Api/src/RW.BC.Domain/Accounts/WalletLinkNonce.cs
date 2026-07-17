using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Domain.Accounts;

public sealed class WalletLinkNonce : Entity<string>, IAggregateRoot, IAuditable
{
    #region ORM

    private WalletLinkNonce() : base(string.Empty)
    {
    }

    #endregion

    private WalletLinkNonce(string accountId, string nonce, string message, DateTimeOffset expiresAt)
        : base(accountId.ThrowIfNullOrInvalid(IdMinLength, IdMaxLength, nameof(accountId)))
    {
        Nonce = nonce.ThrowIfNullOrInvalid(NonceMinLength, NonceMaxLength, nameof(nonce));
        Message = message.ThrowIfNullOrInvalid(MessageMinLength, MessageMaxLength, nameof(message));
        ExpiresAt = expiresAt;
    }

    public string AccountId => Id;
    public string Nonce { get; private set; } = null!;
    public string Message { get; private set; } = null!;
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }

    void IAuditable.SetCreationTimestamp() => CreatedAt = DateTimeOffset.UtcNow;
    void IAuditable.SetUpdateTimestamp() => UpdatedAt = DateTimeOffset.UtcNow;

    public static WalletLinkNonce Issue(string accountId, string nonce, string message, DateTimeOffset expiresAt)
    {
        return new WalletLinkNonce(accountId, nonce, message, expiresAt);
    }

    public void Refresh(string nonce, string message, DateTimeOffset expiresAt)
    {
        Nonce = nonce.ThrowIfNullOrInvalid(NonceMinLength, NonceMaxLength, nameof(nonce));
        Message = message.ThrowIfNullOrInvalid(MessageMinLength, MessageMaxLength, nameof(message));
        ExpiresAt = expiresAt;
    }

    public bool IsExpired(DateTimeOffset now) => ExpiresAt < now;

    #region Constants

    private const int IdMinLength = 1;
    public const int IdMaxLength = 128;

    private const int NonceMinLength = 1;
    public const int NonceMaxLength = 128;

    private const int MessageMinLength = 1;
    public const int MessageMaxLength = 1024;

    #endregion
}
