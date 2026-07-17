using RW.BC.Domain.Accounts;
using RW.BC.Domain.Accounts.Enums;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Domain.UnitTests.Accounts;

public sealed class AccountTests
{
    private readonly string _uid = "firebase-uid-" + Guid.NewGuid().ToString("N")[..12];
    private readonly Email _email = Email.Create("john.doe@example.com");
    private const string ValidNickname = "John_Doe 99";
    private const string ValidWallet = "0x1234567890abcdef1234567890ABCDEF12345678";

    [Fact]
    public void Create_ShouldReturnActiveAccount()
    {
        var sut = Account.Create(_uid, _email, ValidNickname);

        sut.Id.Should().Be(_uid);
        sut.Email.Should().Be(_email);
        sut.Nickname.Should().Be(ValidNickname);
        sut.Status.Should().Be(AccountStatus.Active);
        sut.WalletAddress.Should().BeNull();
        sut.WalletLinkedAt.Should().BeNull();
        sut.WalletLinked.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldTrimNickname()
    {
        var sut = Account.Create(_uid, _email, "  Alice  ");
        sut.Nickname.Should().Be("Alice");
    }

    [Fact]
    public void Create_ShouldThrow_WhenUidIsEmpty()
    {
        FluentActions.Invoking(() => Account.Create(string.Empty, _email, ValidNickname))
            .Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("this_nickname_is_way_too_long")]
    [InlineData("bad$char")]
    [InlineData("with-hyphen")]
    [InlineData("   ")]
    public void Create_ShouldThrow_WhenNicknameInvalid(string nickname)
    {
        FluentActions.Invoking(() => Account.Create(_uid, _email, nickname))
            .Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData("Alice_1", true)]
    [InlineData("John Doe", true)]
    [InlineData("ab", false)]
    [InlineData("this_nickname_is_way_too_long", false)]
    [InlineData("bad$char", false)]
    [InlineData("with-hyphen", false)]
    public void IsValidNickname_ShouldReflectDomainInvariant(string candidate, bool expected)
    {
        Account.IsValidNickname(candidate).Should().Be(expected);
    }

    [Fact]
    public void LinkWallet_ShouldSetAddressAndTimestamp()
    {
        var sut = Account.Create(_uid, _email, ValidNickname);

        sut.LinkWallet($"  {ValidWallet}  ");

        sut.WalletAddress.Should().Be(ValidWallet);
        sut.WalletLinked.Should().BeTrue();
        sut.WalletLinkedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
    }

    [Theory]
    [InlineData("0x123")]
    [InlineData("1234567890abcdef1234567890abcdef12345678")]
    [InlineData("0xZZZ4567890abcdef1234567890abcdef12345678")]
    public void LinkWallet_ShouldThrow_WhenAddressInvalid(string address)
    {
        var sut = Account.Create(_uid, _email, ValidNickname);
        FluentActions.Invoking(() => sut.LinkWallet(address))
            .Should().Throw<DomainException>();
    }

    [Fact]
    public void UnlinkWallet_ShouldClearAddressAndTimestamp()
    {
        var sut = Account.Create(_uid, _email, ValidNickname);
        sut.LinkWallet(ValidWallet);

        sut.UnlinkWallet();

        sut.WalletAddress.Should().BeNull();
        sut.WalletLinkedAt.Should().BeNull();
        sut.WalletLinked.Should().BeFalse();
    }

    [Fact]
    public void Auditable_SetTimestamps_ShouldPopulateCreatedAndUpdated()
    {
        IAuditable sut = Account.Create(_uid, _email, ValidNickname);

        sut.SetCreationTimestamp();
        sut.SetUpdateTimestamp();

        sut.CreatedAt.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(2));
        sut.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void PrivateOrmConstructor_ShouldBeInvokable()
    {
        var instance = Activator.CreateInstance(typeof(Account), nonPublic: true);
        instance.Should().NotBeNull().And.BeOfType<Account>();
    }
}
