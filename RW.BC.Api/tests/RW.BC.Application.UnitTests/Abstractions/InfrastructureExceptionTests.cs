using RW.BC.Application.Abstractions;

namespace RW.BC.Application.UnitTests.Abstractions;

public sealed class InfrastructureExceptionTests
{
    [Fact]
    public void Constructor_WithMessage_SetsMessage()
    {
        var ex = new InfrastructureException("io fail");

        ex.Message.Should().Be("io fail");
        ex.InnerException.Should().BeNull();
    }

    [Fact]
    public void Constructor_WithInner_SetsMessageAndInner()
    {
        var inner = new TimeoutException("timeout");

        var ex = new InfrastructureException("io fail", inner);

        ex.Message.Should().Be("io fail");
        ex.InnerException.Should().BeSameAs(inner);
    }
}
