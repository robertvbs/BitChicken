using FluentAssertions;
using RW.BC.Api.Realtime;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Realtime;

public sealed class ListingsChangeDetectorTests
{
    private readonly ListingsChangeDetector _sut = new();

    [Fact]
    public void HasChanged_ShouldReturnFalse_WhenCurrentIsNull()
    {
        _sut.HasChanged(previous: null, current: null).Should().BeFalse();
    }

    [Fact]
    public void HasChanged_ShouldReturnFalse_WhenCurrentIsNull_AndPreviousHadValue()
    {
        var previous = new ListingsSnapshot(1, 100L);

        _sut.HasChanged(previous, current: null).Should().BeFalse();
    }

    [Fact]
    public void HasChanged_ShouldReturnTrue_WhenPreviousWasNull_AndCurrentHasValue()
    {
        var current = new ListingsSnapshot(1, 100L);

        _sut.HasChanged(previous: null, current).Should().BeTrue();
    }

    [Fact]
    public void HasChanged_ShouldReturnFalse_WhenCurrentMatchesPrevious()
    {
        var snapshot = new ListingsSnapshot(5, 200L);

        _sut.HasChanged(snapshot, snapshot).Should().BeFalse();
    }

    [Fact]
    public void HasChanged_ShouldReturnTrue_WhenCountDiffers()
    {
        var previous = new ListingsSnapshot(5, 200L);
        var current = new ListingsSnapshot(6, 200L);

        _sut.HasChanged(previous, current).Should().BeTrue();
    }

    [Fact]
    public void HasChanged_ShouldReturnTrue_WhenMaxBlockDiffers()
    {
        var previous = new ListingsSnapshot(5, 200L);
        var current = new ListingsSnapshot(5, 201L);

        _sut.HasChanged(previous, current).Should().BeTrue();
    }
}
