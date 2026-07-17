using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Domain.UnitTests.BuildingBlocks;

public sealed class EntityTests
{
    private sealed class StringEntity(string id) : Entity<string>(id);

    [Fact]
    public void Equals_ShouldBeTrue_ForSameTypeAndId()
    {
        var a = new StringEntity("id-1");
        var b = new StringEntity("id-1");
        a.Should().Be(b);
    }

    [Fact]
    public void Equals_ShouldBeFalse_ForDifferentId()
    {
        var a = new StringEntity("id-1");
        var b = new StringEntity("id-2");
        a.Should().NotBe(b);
    }

    [Fact]
    public void GetHashCode_ShouldBeEqual_ForSameTypeAndId()
    {
        var a = new StringEntity("id-1");
        var b = new StringEntity("id-1");
        a.GetHashCode().Should().Be(b.GetHashCode());
    }

    [Fact]
    public void Equals_ShouldBeFalse_ForNull()
    {
        var a = new StringEntity("id-1");
        a.Equals(null).Should().BeFalse();
    }
}
