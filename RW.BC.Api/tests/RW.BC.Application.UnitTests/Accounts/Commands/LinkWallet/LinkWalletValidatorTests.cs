using RW.BC.Application.Accounts.Commands.LinkWallet;

namespace RW.BC.Application.UnitTests.Accounts.Commands.LinkWallet;

public sealed class LinkWalletValidatorTests
{
    private readonly LinkWalletValidator _sut = new();

    private const string ValidWallet = "0x1234567890abcdef1234567890abcdef12345678";
    private static readonly string ValidSignature = "0x" + new string('a', 130);

    private static LinkWalletCommand Valid(string address = ValidWallet, string? signature = null) =>
        new("uid", address, signature ?? ValidSignature);

    [Fact]
    public void Validate_ShouldPass_ForValidCommand()
    {
        _sut.Validate(Valid()).IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-address")]
    [InlineData("0x123")]
    [InlineData("1234567890abcdef1234567890abcdef12345678")]
    public void Validate_ShouldFail_ForInvalidAddress(string address)
    {
        _sut.Validate(Valid(address: address)).IsValid.Should().BeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("0xsig")]
    [InlineData("0x" + "a")]
    public void Validate_ShouldFail_ForInvalidSignature(string sig)
    {
        _sut.Validate(Valid(signature: sig)).IsValid.Should().BeFalse();
    }
}
