using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application.Accounts.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Accounts;

[Collection("Api")]
public sealed class JitProvisioningTests(ApiWebApplicationFactory factory)
{
    private static string NewUid() => "uid-" + Guid.NewGuid().ToString("N")[..16];

    [Fact]
    public async Task GetMe_ShouldReturn200_AndProvisionAccount_OnFirstAuthenticatedRequest()
    {
        var uid = NewUid();
        var client = factory.CreateAuthenticatedClient(uid, "alice@example.com", "Alice_1");

        var response = await client.GetAsync("/accounts/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AccountDto>();
        dto.Should().NotBeNull();
        dto!.Id.Should().Be(uid);
        dto.Email.Should().Be("alice@example.com");
        dto.Nickname.Should().Be("Alice_1");
    }

    [Fact]
    public async Task GetMe_ShouldBeIdempotent_OnSecondRequest()
    {
        var uid = NewUid();
        var client = factory.CreateAuthenticatedClient(uid, "bob@example.com", "Bob_2");

        var first = await client.GetAsync("/accounts/me");
        var second = await client.GetAsync("/accounts/me");

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto1 = await first.Content.ReadFromJsonAsync<AccountDto>();
        var dto2 = await second.Content.ReadFromJsonAsync<AccountDto>();
        dto1!.Id.Should().Be(dto2!.Id);
        dto1.Nickname.Should().Be(dto2.Nickname);
    }

    [Fact]
    public async Task GetMe_ShouldReturn401_WhenNoTokenProvided()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/accounts/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetMe_ShouldUseFallbackNickname_WhenDisplayNameAbsent()
    {
        var uid = NewUid();
        var client = factory.CreateAuthenticatedClient(uid, "charlie_cool@example.com");

        var response = await client.GetAsync("/accounts/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AccountDto>();
        dto!.Nickname.Should().Be("charlie_cool");
    }

    [Fact]
    public async Task GetMe_ShouldReturn409_WhenEmailAlreadyRegisteredUnderDifferentUid()
    {
        var sharedEmail = $"shared-{Guid.NewGuid():N}@example.com";

        var uidA = NewUid();
        var clientA = factory.CreateAuthenticatedClient(uidA, sharedEmail, "UserA_1");
        var firstResponse = await clientA.GetAsync("/accounts/me");
        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var uidB = NewUid();
        var clientB = factory.CreateAuthenticatedClient(uidB, sharedEmail, "UserB_1");
        var secondResponse = await clientB.GetAsync("/accounts/me");

        secondResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task GetMe_ShouldPadNickname_WhenEmailLocalPartIsTooShort()
    {
        var uid = NewUid();
        var client = factory.CreateAuthenticatedClient(uid, "a@example.com");

        var response = await client.GetAsync("/accounts/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AccountDto>();
        dto!.Nickname.Should().HaveLength(3, "local part 'a' (len=1) must be padded to min length 3");
        dto.Nickname.Should().StartWith("a").And.Match("a0*");
    }

    [Fact]
    public async Task GetMe_ShouldTruncateNickname_WhenEmailLocalPartExceedsMaxLength()
    {
        var uid = NewUid();
        var longLocal = new string('x', 30);
        var client = factory.CreateAuthenticatedClient(uid, $"{longLocal}@example.com");

        var response = await client.GetAsync("/accounts/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AccountDto>();
        dto!.Nickname.Should().HaveLength(20, "local part of 30 chars must be truncated to max length 20");
    }

    [Fact]
    public async Task GetMe_ShouldDeriveNicknameFromEmail_WhenDisplayNameIsInvalidAndFallsThrough()
    {
        var uid = NewUid();
        var client = factory.CreateAuthenticatedClient(uid, "valid_user@example.com", "x");

        var response = await client.GetAsync("/accounts/me");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AccountDto>();
        dto!.Nickname.Should().Be("valid_user",
            "display name 'x' is too short; handler must fall through to email-derived nickname");
    }

    [Fact]
    public async Task GetMe_ShouldUseFallbackNickname_WhenEmailHasNoAtSign()
    {
        var uid = NewUid();
        var client = factory.CreateAuthenticatedClient(uid, "nodomain@example.com");
        var client2 = factory.CreateAuthenticatedClient(uid + "x", "nodomain@example.com");

        var response = await client.GetAsync("/accounts/me");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<AccountDto>();
        dto!.Nickname.Should().Be("nodomain");
    }

    [Fact]
    public async Task AccountProvisioningMiddleware_ShouldSkipProvisioning_WhenUnauthenticated()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/accounts/me");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized,
            "unauthenticated requests must reach the auth middleware without triggering provisioning");
    }
}
