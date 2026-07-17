using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Domain.UnitTests.BuildingBlocks;

public sealed class EmailTests
{
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("USER@EXAMPLE.COM")]
    [InlineData("first.last+tag@sub.domain.org")]
    public void Create_ShouldSucceed_ForValidEmail(string email)
    {
        var sut = Email.Create(email);
        sut.Value.Should().Be(email.ToLowerInvariant());
    }

    [Fact]
    public void Create_ShouldNormalizeToLowercase()
    {
        var sut = Email.Create("Alice@Example.COM");
        sut.Value.Should().Be("alice@example.com");
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("notanemail")]
    [InlineData("missing@")]
    [InlineData("@nodomain.com")]
    public void Create_ShouldThrow_ForInvalidEmail(string email)
    {
        FluentActions.Invoking(() => Email.Create(email))
            .Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_ShouldThrow_ForNull()
    {
        FluentActions.Invoking(() => Email.Create(null!))
            .Should().Throw<DomainException>();
    }

    [Fact]
    public void ToString_ShouldReturnValue()
    {
        var sut = Email.Create("test@example.com");
        sut.ToString().Should().Be("test@example.com");
    }

    [Fact]
    public void Equality_ShouldHoldForSameValue()
    {
        var a = Email.Create("test@example.com");
        var b = Email.Create("TEST@EXAMPLE.COM");
        a.Should().Be(b);
    }
}
