using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Domain.UnitTests.BuildingBlocks;

public sealed class DomainExceptionTests
{
    [Fact]
    public void Constructor_WithMessage_SetsMessage()
    {
        var ex = new DomainException("boom");

        ex.Message.Should().Be("boom");
        ex.InnerException.Should().BeNull();
    }

    [Fact]
    public void Constructor_WithInner_SetsMessageAndInner()
    {
        var inner = new InvalidOperationException("cause");

        var ex = new DomainException("boom", inner);

        ex.Message.Should().Be("boom");
        ex.InnerException.Should().BeSameAs(inner);
    }
}
