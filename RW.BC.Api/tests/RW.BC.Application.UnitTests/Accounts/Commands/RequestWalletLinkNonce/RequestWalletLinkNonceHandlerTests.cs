using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Commands.RequestWalletLinkNonce;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Application.Accounts.WalletLink;
using RW.BC.Domain.Accounts;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Application.UnitTests.Accounts.Commands.RequestWalletLinkNonce;

public sealed class RequestWalletLinkNonceHandlerTests
{
    private readonly Mock<IAccountRepository> _accountRepository = new(MockBehavior.Strict);
    private readonly Mock<IWalletLinkNonceRepository> _nonceRepository = new(MockBehavior.Strict);
    private readonly Mock<IUnitOfWork> _unitOfWork = new(MockBehavior.Strict);

    private const string Uid = "user-fb-1";
    private const string Wallet = "0x1234567890abcdef1234567890abcdef12345678";

    private RequestWalletLinkNonceHandler Sut() =>
        new(_accountRepository.Object, _nonceRepository.Object, _unitOfWork.Object);

    private static Account MakeAccount() =>
        Account.Create(Uid, Email.Create("alice@example.com"), "Alice_1");

    private static Account MakeAccountWithWallet()
    {
        var account = Account.Create(Uid, Email.Create("alice@example.com"), "Alice_1");
        account.LinkWallet(Wallet);
        return account;
    }

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenAccountMissing()
    {
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Account?)null);

        var act = () => Sut().Handle(new RequestWalletLinkNonceCommand(Uid), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_ShouldThrow409_WhenWalletAlreadyLinked()
    {
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeAccountWithWallet());

        var act = () => Sut().Handle(new RequestWalletLinkNonceCommand(Uid), CancellationToken.None);

        await act.Should().ThrowAsync<WalletAlreadyLinkedException>();
    }

    [Fact]
    public async Task Handle_ShouldAddNonce_WhenNonePresent()
    {
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeAccount());
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WalletLinkNonce?)null);
        WalletLinkNonce? added = null;
        _nonceRepository.Setup(x => x.AddAsync(It.IsAny<WalletLinkNonce>(), It.IsAny<CancellationToken>()))
            .Callback<WalletLinkNonce, CancellationToken>((n, _) => added = n)
            .Returns(Task.CompletedTask);
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await Sut().Handle(new RequestWalletLinkNonceCommand(Uid), CancellationToken.None);

        result.Nonce.Should().NotBeNullOrEmpty();
        result.Message.Should().Contain(WalletLinkMessageBuilder.Statement);
        result.Message.Should().Contain(result.Nonce);
        result.Message.Should().Contain(Uid);
        result.ExpiresAt.Should().BeCloseTo(
            DateTimeOffset.UtcNow.Add(RequestWalletLinkNonceHandler.Ttl), TimeSpan.FromSeconds(5));
        added.Should().NotBeNull();
        added!.Nonce.Should().Be(result.Nonce);
        added.Message.Should().Be(result.Message);

        _nonceRepository.Verify(x => x.AddAsync(It.IsAny<WalletLinkNonce>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldReturnExistingNonce_WhenValidNoncePresent()
    {
        var existing = WalletLinkNonce.Issue(Uid, "old-nonce", "old-message", DateTimeOffset.UtcNow.AddMinutes(4));
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeAccount());
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var result = await Sut().Handle(new RequestWalletLinkNonceCommand(Uid), CancellationToken.None);

        result.Nonce.Should().Be("old-nonce", "a valid non-expired nonce must not be overwritten");
        result.Message.Should().Be("old-message");

        _nonceRepository.Verify(x => x.Update(It.IsAny<WalletLinkNonce>()), Times.Never);
        _nonceRepository.Verify(x => x.AddAsync(It.IsAny<WalletLinkNonce>(), It.IsAny<CancellationToken>()), Times.Never);
        _unitOfWork.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldRefreshExpiredNonce_WhenPresent()
    {
        var expired = WalletLinkNonce.Issue(Uid, "old-nonce", "old-message", DateTimeOffset.UtcNow.AddSeconds(-1));
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeAccount());
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expired);
        _nonceRepository.Setup(x => x.Update(expired));
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await Sut().Handle(new RequestWalletLinkNonceCommand(Uid), CancellationToken.None);

        result.Nonce.Should().NotBe("old-nonce", "an expired nonce must be replaced with a fresh one");
        result.Message.Should().Contain(result.Nonce);

        _nonceRepository.Verify(x => x.Update(expired), Times.Once);
        _nonceRepository.Verify(x => x.AddAsync(It.IsAny<WalletLinkNonce>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
