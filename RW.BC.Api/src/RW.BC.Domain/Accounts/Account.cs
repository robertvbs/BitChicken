using System.Text.RegularExpressions;
using RW.BC.Domain.BuildingBlocks;
using RW.BC.Domain.Accounts.Enums;

namespace RW.BC.Domain.Accounts;

public sealed partial class Account : Entity<string>, IAggregateRoot, IAuditable
{
    #region ORM

    private Account() : base(string.Empty)
    {
    }

    #endregion

    private Account(string id, Email email, string nickname)
        : base(id.ThrowIfNullOrInvalid(IdMinLength, IdMaxLength, nameof(id)))
    {
        Email = email.ThrowIfNull(nameof(email));
        Nickname = NormalizeNickname(nickname);
        Status = AccountStatus.Active;
    }

    public Email Email { get; private set; } = null!;
    public string Nickname { get; private set; } = null!;
    public AccountStatus Status { get; private set; }
    public string? WalletAddress { get; private set; }
    public DateTimeOffset? WalletLinkedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }

    public bool WalletLinked => WalletAddress is not null;

    void IAuditable.SetCreationTimestamp() => CreatedAt = DateTimeOffset.UtcNow;
    void IAuditable.SetUpdateTimestamp() => UpdatedAt = DateTimeOffset.UtcNow;

    public static Account Create(string uid, Email email, string nickname)
    {
        return new Account(uid, email, nickname);
    }

    public void LinkWallet(string address)
    {
        var normalized = address.ThrowIfNull(nameof(address)).Trim();
        if (!WalletAddressRegex().IsMatch(normalized))
            throw new DomainException($"'{nameof(address)}' must be a valid EVM wallet address.");

        WalletAddress = normalized;
        WalletLinkedAt = DateTimeOffset.UtcNow;
    }

    public void UnlinkWallet()
    {
        WalletAddress = null;
        WalletLinkedAt = null;
    }

    public static bool IsValidNickname(string candidate) =>
        candidate.Length >= NicknameMinLength &&
        candidate.Length <= NicknameMaxLength &&
        NicknameRegex().IsMatch(candidate);

    private static string NormalizeNickname(string nickname)
    {
        var value = nickname.ThrowIfNullOrInvalid(NicknameMinLength, NicknameMaxLength, nameof(nickname)).Trim();
        if (value.Length < NicknameMinLength || value.Length > NicknameMaxLength || !NicknameRegex().IsMatch(value))
            throw new DomainException(
                $"'{nameof(nickname)}' must be {NicknameMinLength}-{NicknameMaxLength} characters: letters, digits, spaces or underscores.");

        return value;
    }

    [GeneratedRegex(@"^[A-Za-z0-9 _]{3,20}$")]
    private static partial Regex NicknameRegex();

    [GeneratedRegex(@"^0x[0-9a-fA-F]{40}$")]
    private static partial Regex WalletAddressRegex();

    #region Constants

    public const int IdMinLength = 1;
    public const int IdMaxLength = 128;

    public const int NicknameMinLength = 3;
    public const int NicknameMaxLength = 20;

    #endregion
}
