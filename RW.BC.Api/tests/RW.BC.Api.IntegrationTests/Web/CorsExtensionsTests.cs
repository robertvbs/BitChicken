using FluentAssertions;
using RW.BC.Api.Web;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Web;

public sealed class CorsExtensionsTests
{
    [Theory]
    [InlineData("https://app.example.com", new[] { "https://localhost:4200" }, new[] { ".example.com" }, true)]
    [InlineData("https://sub.example.com", new[] { "https://localhost:4200" }, new[] { ".example.com" }, true)]
    [InlineData("https://localhost:4200", new[] { "https://localhost:4200" }, new[] { ".example.com" }, true)]
    [InlineData("https://evil.com", new[] { "https://localhost:4200" }, new[] { ".example.com" }, false)]
    [InlineData("not-a-url", new[] { "https://localhost:4200" }, new[] { ".example.com" }, false)]
    public void IsOriginAllowed_ShouldReturnExpected(
        string origin, string[] explicitOrigins, string[] hostSuffixes, bool expected)
    {
        CorsExtensions.IsOriginAllowed(origin, explicitOrigins, hostSuffixes).Should().Be(expected);
    }
}
