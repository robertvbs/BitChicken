using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Dtos;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Application.Accounts.Queries.GetMyAccount;
using RW.BC.Domain.Accounts;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Application.UnitTests.Accounts.Queries.GetMyAccount;

public sealed class GetMyAccountHandlerTests
{
    private readonly Mock<IAccountRepository> _accountRepository = new(MockBehavior.Strict);

    private GetMyAccountHandler Sut() => new(_accountRepository.Object);

    private const string Uid = "user-fb-1";
    private const string Wallet = "0x1234567890abcdef1234567890abcdef12345678";

    [Fact]
    public async Task Handle_ShouldThrowNotFoundException_WhenAccountNotFound()
    {
        _accountRepository.Setup(x => x.GetByIdNoTrackingAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Account?)null);

        var act = () => Sut().Handle(new GetMyAccountQuery(Uid), CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>()
            .WithMessage("*Account*");
    }

    [Fact]
    public async Task Handle_ShouldMapAccount_WithoutWallet()
    {
        var account = Account.Create(Uid, Email.Create("alice@example.com"), "Alice_1");
        _accountRepository.Setup(x => x.GetByIdNoTrackingAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);

        var result = await Sut().Handle(new GetMyAccountQuery(Uid), CancellationToken.None);

        result.Id.Should().Be(Uid);
        result.Email.Should().Be("alice@example.com");
        result.Nickname.Should().Be("Alice_1");
        result.Status.Should().Be(AccountStatusDto.Active);
        result.WalletAddress.Should().BeNull();
        result.WalletLinked.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_ShouldMapAccount_WithLinkedWallet()
    {
        var account = Account.Create(Uid, Email.Create("alice@example.com"), "Alice_1");
        account.LinkWallet(Wallet);
        _accountRepository.Setup(x => x.GetByIdNoTrackingAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);

        var result = await Sut().Handle(new GetMyAccountQuery(Uid), CancellationToken.None);

        result.WalletAddress.Should().Be(Wallet);
        result.WalletLinked.Should().BeTrue();
    }
}
