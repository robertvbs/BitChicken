using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using RW.BC.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Web;

[Collection("Api")]
public sealed class RateLimitingTests(ApiWebApplicationFactory factory)
{
    private HttpClient CreateTightlyLimitedClient()
    {
        var tight = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(cfg =>
            {
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["RateLimiting:Global:PermitLimit"] = "1",
                    ["RateLimiting:Global:WindowSeconds"] = "60",
                    ["RateLimiting:Global:QueueLimit"] = "0",
                    ["RateLimiting:WalletPolicy:PermitLimit"] = "1",
                    ["RateLimiting:WalletPolicy:WindowSeconds"] = "60",
                    ["RateLimiting:WalletPolicy:QueueLimit"] = "0"
                });
            });
        });
        return tight.CreateClient();
    }

    [Fact]
    public async Task GlobalRateLimiter_ShouldReturn429_AfterLimitExceeded()
    {
        var client = CreateTightlyLimitedClient();

        var first = await client.GetAsync("/transparency/summary");
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        var second = await client.GetAsync("/transparency/summary");
        second.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }

    [Fact]
    public async Task GlobalRateLimiter_ShouldReturn429_WithProblemDetailsContentType()
    {
        var client = CreateTightlyLimitedClient();

        await client.GetAsync("/transparency/summary");
        var rejected = await client.GetAsync("/transparency/summary");

        rejected.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
        rejected.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
    }

    [Fact]
    public async Task WalletLinkPolicy_ShouldReturn429_AfterLimitExceeded()
    {
        var client = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureAppConfiguration(cfg =>
            {
                cfg.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["RateLimiting:Global:PermitLimit"] = "1000",
                    ["RateLimiting:WalletPolicy:PermitLimit"] = "1",
                    ["RateLimiting:WalletPolicy:WindowSeconds"] = "60",
                    ["RateLimiting:WalletPolicy:QueueLimit"] = "0"
                });
            });
        }).CreateClient();

        client.DefaultRequestHeaders.Add(TestAuthHandler.UidHeader, "rate-limit-test-uid");
        client.DefaultRequestHeaders.Add(TestAuthHandler.EmailHeader, "ratelimit@example.com");

        var first = await client.PostAsync("/accounts/me/wallet/nonce", null);
        first.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests, "first request must not be rate-limited");

        var second = await client.PostAsync("/accounts/me/wallet/nonce", null);
        second.StatusCode.Should().Be(HttpStatusCode.TooManyRequests,
            "second request to wallet-link endpoint should be rejected by the per-endpoint policy");
    }

    [Fact]
    public async Task NormalTraffic_ShouldNotBeRateLimited_WithDefaultLimits()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/summary");

        response.StatusCode.Should().NotBe(HttpStatusCode.TooManyRequests,
            "a single request must never trigger the rate limiter");
    }
}
