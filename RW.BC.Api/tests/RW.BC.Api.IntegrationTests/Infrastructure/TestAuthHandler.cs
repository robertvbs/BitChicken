using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace RW.BC.Api.IntegrationTests.Infrastructure;

public sealed class TestAuthOptions : AuthenticationSchemeOptions;

public sealed class TestAuthHandler(
    IOptionsMonitor<TestAuthOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<TestAuthOptions>(options, logger, encoder)
{
    public const string SchemeName = "TestAuth";
    public const string UidHeader = "X-Test-Uid";
    public const string EmailHeader = "X-Test-Email";
    public const string DisplayNameHeader = "X-Test-DisplayName";

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(UidHeader, out var uid) || string.IsNullOrEmpty(uid))
            return Task.FromResult(AuthenticateResult.NoResult());

        var email = Request.Headers.TryGetValue(EmailHeader, out var e) ? (string?)e : "test@example.com";
        var displayName = Request.Headers.TryGetValue(DisplayNameHeader, out var d) ? (string?)d : null;

        var claims = new List<Claim>
        {
            new("user_id", uid!),
            new("email", email ?? "test@example.com")
        };
        if (!string.IsNullOrEmpty(displayName))
            claims.Add(new Claim("name", displayName));

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
