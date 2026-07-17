using System.Security.Claims;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;
using RW.BC.Api.Identity;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Identity;

public sealed class HttpCurrentUserTests
{
    private static HttpCurrentUser BuildSut(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, "test");
        var principal = new ClaimsPrincipal(identity);

        var accessor = new Mock<IHttpContextAccessor>();
        var ctx = new DefaultHttpContext { User = principal };
        accessor.Setup(x => x.HttpContext).Returns(ctx);

        return new HttpCurrentUser(accessor.Object);
    }

    [Fact]
    public void Id_ShouldReturnUserId_FromUserIdClaim()
    {
        var sut = BuildSut(new Claim("user_id", "uid-123"));
        sut.Id.Should().Be("uid-123");
    }

    [Fact]
    public void Id_ShouldFallBackToSub_WhenUserIdAbsent()
    {
        var sut = BuildSut(new Claim("sub", "sub-456"));
        sut.Id.Should().Be("sub-456");
    }

    [Fact]
    public void Id_ShouldReturnNull_WhenNeitherClaimPresent()
    {
        var sut = BuildSut();
        sut.Id.Should().BeNull();
    }

    [Fact]
    public void DisplayName_ShouldReturnNameClaim()
    {
        var sut = BuildSut(new Claim("user_id", "uid-1"), new Claim("name", "Alice_1"));
        sut.DisplayName.Should().Be("Alice_1");
    }

    [Fact]
    public void AllProperties_ShouldReturnNull_WhenNoHttpContext()
    {
        var accessor = new Mock<IHttpContextAccessor>();
        accessor.Setup(x => x.HttpContext).Returns((HttpContext?)null);
        var sut = new HttpCurrentUser(accessor.Object);

        sut.Id.Should().BeNull();
        sut.DisplayName.Should().BeNull();
    }

    [Fact]
    public void DisplayName_ShouldFallBackToIdentityName_WhenNameClaimAbsent()
    {
        var identity = new ClaimsIdentity(
            [new Claim("user_id", "uid-fallback")],
            authenticationType: "test",
            nameType: "user_id",
            roleType: ClaimTypes.Role);
        var principal = new ClaimsPrincipal(identity);
        var accessor = new Mock<IHttpContextAccessor>();
        accessor.Setup(x => x.HttpContext).Returns(new DefaultHttpContext { User = principal });

        var sut = new HttpCurrentUser(accessor.Object);

        sut.DisplayName.Should().NotBeNull("Identity.Name is set when the identity name type maps to user_id");
    }

    [Fact]
    public void DisplayName_ShouldReturnNull_WhenNeitherNameClaimNorIdentityName()
    {
        var sut = BuildSut(new Claim("user_id", "uid-no-name"));
        sut.DisplayName.Should().BeNull("no 'name' claim and Identity.Name is null when name claim type is unset");
    }
}
