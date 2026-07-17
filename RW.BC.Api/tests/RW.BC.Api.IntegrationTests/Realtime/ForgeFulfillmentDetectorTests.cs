using FluentAssertions;
using RW.BC.Api.Realtime;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Realtime;

public sealed class ForgeFulfillmentDetectorTests
{
    [Fact]
    public void LastFulfilledAtBlock_ShouldBeZero_Initially()
    {
        var sut = new ForgeFulfillmentDetector();

        sut.LastFulfilledAtBlock.Should().Be(0L);
    }
}
