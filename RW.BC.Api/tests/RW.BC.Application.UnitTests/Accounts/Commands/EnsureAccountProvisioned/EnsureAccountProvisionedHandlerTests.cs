using Microsoft.Extensions.Logging;
using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Commands.EnsureAccountProvisioned;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Domain.Accounts;

namespace RW.BC.Application.UnitTests.Accounts.Commands.EnsureAccountProvisioned;

public sealed class EnsureAccountProvisionedHandlerTests
{
    private readonly Mock<IAccountRepository> _accountRepository = new(MockBehavior.Strict);
    private readonly Mock<IUnitOfWork> _unitOfWork = new(MockBehavior.Strict);
    private readonly Mock<ILogger<EnsureAccountProvisionedHandler>> _logger = new();

    private const string Uid = "firebase-uid-abc123";
    private const string EmailValue = "alice@example.com";
    private const string DisplayName = "Alice_1";

    private EnsureAccountProvisionedHandler Sut() =>
        new(_accountRepository.Object, _unitOfWork.Object, _logger.Object);

    private void AccountExists() =>
        _accountRepository.Setup(x => x.ExistsByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

    private void AccountDoesNotExist() =>
        _accountRepository.Setup(x => x.ExistsByIdAsync(Uid, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

    private void EmailNotTaken() =>
        _accountRepository.Setup(x => x.ExistsByEmailAsync(EmailValue, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

    private void EmailAlreadyTaken() =>
        _accountRepository.Setup(x => x.ExistsByEmailAsync(EmailValue, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

    private void SetupPersistence()
    {
        _accountRepository.Setup(x => x.AddAsync(It.IsAny<Account>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
    }

    [Fact]
    public async Task Handle_ShouldBeNoOp_WhenAccountAlreadyExistsById()
    {
        AccountExists();

        await Sut().Handle(new EnsureAccountProvisionedCommand(Uid, EmailValue, DisplayName), CancellationToken.None);

        _accountRepository.Verify(x => x.ExistsByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _accountRepository.Verify(x => x.AddAsync(It.IsAny<Account>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldThrowConflictException_WhenEmailBelongsToDifferentIdentity()
    {
        AccountDoesNotExist();
        EmailAlreadyTaken();

        var act = () => Sut().Handle(new EnsureAccountProvisionedCommand(Uid, EmailValue, DisplayName), CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>()
            .WithMessage("*email*");
        _accountRepository.Verify(x => x.AddAsync(It.IsAny<Account>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ShouldCreateAccount_WhenAccountDoesNotExist()
    {
        AccountDoesNotExist();
        EmailNotTaken();
        SetupPersistence();

        await Sut().Handle(new EnsureAccountProvisionedCommand(Uid, EmailValue, DisplayName), CancellationToken.None);

        _accountRepository.Verify(x => x.AddAsync(
            It.Is<Account>(a => a.Id == Uid && a.Email.Value == EmailValue && a.Nickname == DisplayName),
            It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(x => x.CommitAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldUseFallbackNickname_WhenDisplayNameNull()
    {
        AccountDoesNotExist();
        _accountRepository.Setup(x => x.ExistsByEmailAsync("alice_cool@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        SetupPersistence();

        await Sut().Handle(new EnsureAccountProvisionedCommand(Uid, "alice_cool@example.com", null), CancellationToken.None);

        _accountRepository.Verify(x => x.AddAsync(
            It.Is<Account>(a => a.Nickname == "alice_cool"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldUseFallbackNickname_WhenDisplayNameInvalid()
    {
        AccountDoesNotExist();
        _accountRepository.Setup(x => x.ExistsByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        SetupPersistence();

        await Sut().Handle(new EnsureAccountProvisionedCommand(Uid, "user@example.com", "a"), CancellationToken.None);

        _accountRepository.Verify(x => x.AddAsync(
            It.Is<Account>(a => a.Nickname == "user"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldBeIdempotent_WhenConcurrentUidRaceOccurs()
    {
        AccountDoesNotExist();
        EmailNotTaken();
        _accountRepository.Setup(x => x.AddAsync(It.IsAny<Account>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("The record already exists in the system. Check for duplicate data."));

        await Sut().Handle(new EnsureAccountProvisionedCommand(Uid, EmailValue, DisplayName), CancellationToken.None);
    }

    [Fact]
    public async Task Handle_ShouldRethrowConflict_WhenEmailConstraintViolatedAtCommit()
    {
        AccountDoesNotExist();
        EmailNotTaken();
        _accountRepository.Setup(x => x.AddAsync(It.IsAny<Account>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _unitOfWork.Setup(x => x.CommitAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ConflictException("duplicate email", constraintName: "ix_accounts_email"));

        var act = () => Sut().Handle(new EnsureAccountProvisionedCommand(Uid, EmailValue, DisplayName), CancellationToken.None);

        await act.Should().ThrowAsync<ConflictException>();
    }
}
