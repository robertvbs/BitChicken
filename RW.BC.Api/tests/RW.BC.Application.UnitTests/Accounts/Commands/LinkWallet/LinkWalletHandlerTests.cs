using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Commands.LinkWallet;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Application.Accounts.WalletLink;
using RW.BC.Domain.Accounts;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Application.UnitTests.Accounts.Commands.LinkWallet;

public sealed class LinkWalletHandlerTests
{
    private readonly Mock<IAccountRepository> _accountRepository = new(MockBehavior.Strict);
    private readonly Mock<IWalletLinkNonceRepository> _nonceRepository = new(MockBehavior.Strict);
    private readonly Mock<ISignatureVerifier> _signatureVerifier = new(MockBehavior.Strict);
    private readonly Mock<IUnitOfWork> _unitOfWork = new(MockBehavior.Strict);

    private const string Uid = "user-fb-1";
    private const string Wallet = "0x1234567890abcdef1234567890abcdef12345678";
    private const string Signature = "0xsignature";

    private LinkWalletHandler Sut() => new(
        _accountRepository.Object,
        _nonceRepository.Object,
        _signatureVerifier.Object,
        _unitOfWork.Object);

    private static Account MakeAccount() =>
        Account.Create(Uid, Email.Create("alice@example.com"), "Alice_1");

    private static WalletLinkNonce ActiveNonce() =>
        WalletLinkNonce.Issue(Uid, "nonce-1", "the-message", DateTimeOffset.UtcNow.AddMinutes(5));

    private LinkWalletCommand Command(string address = Wallet) => new(Uid, address, Signature);

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenAccountMissing()
    {
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Account?)null);

        var act = () => Sut().Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_ShouldThrowNonceUnavailable_WhenNonceMissing()
    {
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeAccount());
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync((WalletLinkNonce?)null);

        var act = () => Sut().Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<WalletLinkNonceUnavailableException>();
    }

    [Fact]
    public async Task Handle_ShouldThrowNonceUnavailable_WhenNonceExpired()
    {
        var expired = WalletLinkNonce.Issue(Uid, "nonce-1", "msg", DateTimeOffset.UtcNow.AddMinutes(-1));
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeAccount());
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expired);

        var act = () => Sut().Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<WalletLinkNonceUnavailableException>();
    }

    [Fact]
    public async Task Handle_ShouldThrowSignatureInvalid_WhenRecoveredAddressMismatches()
    {
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(MakeAccount());
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ActiveNonce());
        _signatureVerifier.Setup(x => x.RecoverAddress("the-message", Signature))
            .Returns("0x0000000000000000000000000000000000000000");

        var act = () => Sut().Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<WalletLinkSignatureInvalidException>();
    }

    [Fact]
    public async Task Handle_ShouldLinkWalletAndConsumeNonce_OnSuccess()
    {
        var account = MakeAccount();
        var nonce = ActiveNonce();
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(nonce);
        var recovered = "0x1234567890ABCDEF1234567890abcdef12345678";
        _signatureVerifier.Setup(x => x.RecoverAddress("the-message", Signature))
            .Returns(recovered);
        _accountRepository.Setup(x => x.Update(account));
        _nonceRepository.Setup(x => x.Remove(nonce));
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await Sut().Handle(Command(), CancellationToken.None);

        result.WalletLinked.Should().BeTrue();
        result.WalletAddress.Should().Be(recovered);
        account.WalletLinked.Should().BeTrue();
        _accountRepository.Verify(x => x.Update(account), Times.Once);
        _nonceRepository.Verify(x => x.Remove(nonce), Times.Once);
        _unitOfWork.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenWalletAlreadyLinkedElsewhere()
    {
        var account = MakeAccount();
        var nonce = ActiveNonce();
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);
        _nonceRepository.Setup(x => x.GetByAccountIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(nonce);
        _signatureVerifier.Setup(x => x.RecoverAddress("the-message", Signature))
            .Returns(Wallet);
        _accountRepository.Setup(x => x.Update(account));
        _nonceRepository.Setup(x => x.Remove(nonce));
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("wallet_address unique violation"));

        var act = () => Sut().Handle(Command(), CancellationToken.None);

        await act.Should().ThrowAsync<WalletAlreadyLinkedException>();
    }
}
