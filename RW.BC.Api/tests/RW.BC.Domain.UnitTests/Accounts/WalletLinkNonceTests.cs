using RW.BC.Domain.Accounts;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Domain.UnitTests.Accounts;

public sealed class WalletLinkNonceTests
{
    private readonly string _accountId = "firebase-uid-" + Guid.NewGuid().ToString("N")[..12];
    private const string Nonce = "0123456789abcdef0123456789abcdef";
    private const string Message = "Link this wallet to your BitChicken account";

    [Fact]
    public void Issue_ShouldPopulateAllFields()
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(5);

        var sut = WalletLinkNonce.Issue(_accountId, Nonce, Message, expiresAt);

        sut.Id.Should().Be(_accountId);
        sut.AccountId.Should().Be(_accountId);
        sut.Nonce.Should().Be(Nonce);
        sut.Message.Should().Be(Message);
        sut.ExpiresAt.Should().Be(expiresAt);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Issue_ShouldThrow_WhenNonceInvalid(string? nonce)
    {
        var act = () => WalletLinkNonce.Issue(_accountId, nonce!, Message, DateTimeOffset.UtcNow);

        act.Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Issue_ShouldThrow_WhenMessageInvalid(string? message)
    {
        var act = () => WalletLinkNonce.Issue(_accountId, Nonce, message!, DateTimeOffset.UtcNow);

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Refresh_ShouldReplaceNonceMessageAndExpiry()
    {
        var sut = WalletLinkNonce.Issue(_accountId, Nonce, Message, DateTimeOffset.UtcNow.AddMinutes(5));
        var newExpiry = DateTimeOffset.UtcNow.AddMinutes(10);

        sut.Refresh("new-nonce", "new-message", newExpiry);

        sut.Nonce.Should().Be("new-nonce");
        sut.Message.Should().Be("new-message");
        sut.ExpiresAt.Should().Be(newExpiry);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Refresh_ShouldThrow_WhenNonceInvalid(string? nonce)
    {
        var sut = WalletLinkNonce.Issue(_accountId, Nonce, Message, DateTimeOffset.UtcNow.AddMinutes(5));

        var act = () => sut.Refresh(nonce!, "msg", DateTimeOffset.UtcNow);

        act.Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void Refresh_ShouldThrow_WhenMessageInvalid(string? message)
    {
        var sut = WalletLinkNonce.Issue(_accountId, Nonce, Message, DateTimeOffset.UtcNow.AddMinutes(5));

        var act = () => sut.Refresh("nonce", message!, DateTimeOffset.UtcNow);

        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void IsExpired_ShouldBeTrue_WhenExpiryInThePast()
    {
        var sut = WalletLinkNonce.Issue(_accountId, Nonce, Message, DateTimeOffset.UtcNow.AddMinutes(-1));

        sut.IsExpired(DateTimeOffset.UtcNow).Should().BeTrue();
    }

    [Fact]
    public void IsExpired_ShouldBeFalse_WhenExpiryInTheFuture()
    {
        var sut = WalletLinkNonce.Issue(_accountId, Nonce, Message, DateTimeOffset.UtcNow.AddMinutes(5));

        sut.IsExpired(DateTimeOffset.UtcNow).Should().BeFalse();
    }
}
