using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Domain.UnitTests.BuildingBlocks;

public sealed class PrimitiveValidationsTests
{
    [Fact]
    public void ThrowIfNull_ShouldReturnValue_WhenNotNull()
    {
        var obj = new object();
        obj.ThrowIfNull().Should().BeSameAs(obj);
    }

    [Fact]
    public void ThrowIfNull_ShouldThrow_WhenNull()
    {
        object? obj = null;
        FluentActions.Invoking(() => obj.ThrowIfNull())
            .Should().Throw<DomainException>();
    }

    [Theory]
    [InlineData("abc", 3, 10)]
    [InlineData("hello world", 3, 20)]
    public void ThrowIfNullOrInvalid_ShouldReturnValue_WhenValid(string value, int min, int max)
    {
        value.ThrowIfNullOrInvalid(min, max).Should().Be(value);
    }

    [Fact]
    public void ThrowIfNullOrInvalid_ShouldThrow_WhenNull()
    {
        string? value = null;
        FluentActions.Invoking(() => value.ThrowIfNullOrInvalid(1, 10))
            .Should().Throw<DomainException>();
    }

    [Fact]
    public void ThrowIfNullOrInvalid_ShouldThrow_WhenTooShort()
    {
        FluentActions.Invoking(() => "ab".ThrowIfNullOrInvalid(3, 10))
            .Should().Throw<DomainException>();
    }

    [Fact]
    public void ThrowIfNullOrInvalid_ShouldThrow_WhenTooLong()
    {
        FluentActions.Invoking(() => "toolongvalue".ThrowIfNullOrInvalid(1, 5))
            .Should().Throw<DomainException>();
    }

    [Fact]
    public void ThrowIfNullOrInvalid_ShouldThrow_WhenWhitespace()
    {
        FluentActions.Invoking(() => "   ".ThrowIfNullOrInvalid(1, 10))
            .Should().Throw<DomainException>();
    }
}
