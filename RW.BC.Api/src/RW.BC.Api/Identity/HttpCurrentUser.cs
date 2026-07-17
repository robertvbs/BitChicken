using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using RW.BC.Application.Abstractions;

namespace RW.BC.Api.Identity;

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public string? Id =>
        Principal?.FindFirst(IdentityClaims.ExternalUserId)?.Value
        ?? Principal?.FindFirst(IdentityClaims.ExternalUserIdFallback)?.Value;

    public string? DisplayName => Principal?.FindFirst(IdentityClaims.DisplayName)?.Value
                                  ?? Principal?.Identity?.Name;
}
