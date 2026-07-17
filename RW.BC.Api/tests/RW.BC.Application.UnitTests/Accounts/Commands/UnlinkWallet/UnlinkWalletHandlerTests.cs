using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Commands.UnlinkWallet;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Domain.Accounts;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Application.UnitTests.Accounts.Commands.UnlinkWallet;

public sealed class UnlinkWalletHandlerTests
{
    private readonly Mock<IAccountRepository> _accountRepository = new(MockBehavior.Strict);
    private readonly Mock<IUnitOfWork> _unitOfWork = new(MockBehavior.Strict);

    private const string Uid = "user-fb-1";
    private const string Wallet = "0x1234567890abcdef1234567890abcdef12345678";

    private UnlinkWalletHandler Sut() => new(_accountRepository.Object, _unitOfWork.Object);

    private static Account LinkedAccount()
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

        var act = () => Sut().Handle(new UnlinkWalletCommand(Uid), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_ShouldUnlinkWallet_OnSuccess()
    {
        var account = LinkedAccount();
        _accountRepository.Setup(x => x.GetByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);
        _accountRepository.Setup(x => x.Update(account));
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var result = await Sut().Handle(new UnlinkWalletCommand(Uid), CancellationToken.None);

        result.WalletLinked.Should().BeFalse();
        result.WalletAddress.Should().BeNull();
        account.WalletLinked.Should().BeFalse();
        _accountRepository.Verify(x => x.Update(account), Times.Once);
        _unitOfWork.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
