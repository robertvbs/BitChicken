using RW.BC.Application.Accounts.WalletLink;

namespace RW.BC.Application.UnitTests.Accounts.WalletLink;

public sealed class WalletLinkMessageBuilderTests
{
    [Fact]
    public void Build_ShouldEmbedStatementAccountNonceAndIssuedAt()
    {
        var issuedAt = new DateTimeOffset(2026, 6, 16, 12, 30, 45, TimeSpan.Zero);

        var message = WalletLinkMessageBuilder.Build("acct-1", "deadbeef", issuedAt);

        message.Should().Be(
            "Link this wallet to your BitChicken account\n\n" +
            "Account: acct-1\n" +
            "Nonce: deadbeef\n" +
            "Issued At: 2026-06-16T12:30:45Z");
    }

    [Fact]
    public void Build_ShouldNormalizeIssuedAtToUtc()
    {
        var issuedAt = new DateTimeOffset(2026, 6, 16, 9, 0, 0, TimeSpan.FromHours(-3));

        var message = WalletLinkMessageBuilder.Build("acct-1", "n", issuedAt);

        message.Should().Contain("Issued At: 2026-06-16T12:00:00Z");
    }
}
