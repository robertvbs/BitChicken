using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace RW.BC.Api.Identity;

[ExcludeFromCodeCoverage]
public static class FirebaseJwtExtensions
{
    public static AuthenticationBuilder AddFirebaseJwtBearer(
        this AuthenticationBuilder builder,
        IConfiguration configuration,
        string sectionName = "Identity:Firebase")
    {
        var projectId = configuration.GetSection(sectionName).GetValue<string>("ProjectId")
                        ?? throw new InvalidOperationException($"Configuration '{sectionName}:ProjectId' not found.");

        var issuer = $"https://securetoken.google.com/{projectId}";
        var oidcMetadata = $"{issuer}/.well-known/openid-configuration";

        return builder.AddJwtBearer(options =>
        {
            options.MetadataAddress = oidcMetadata;
            options.MapInboundClaims = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = projectId,
                ValidateLifetime = true,
                NameClaimType = IdentityClaims.ExternalUserId
            };
        });
    }
}
