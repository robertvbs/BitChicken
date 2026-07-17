using System.Globalization;

namespace RW.BC.Application.Accounts.WalletLink;

public static class WalletLinkMessageBuilder
{
    public const string Statement = "Link this wallet to your BitChicken account";

    public static string Build(string accountId, string nonce, DateTimeOffset issuedAt)
    {
        var issuedAtText = issuedAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);
        return $"{Statement}\n\nAccount: {accountId}\nNonce: {nonce}\nIssued At: {issuedAtText}";
    }
}
