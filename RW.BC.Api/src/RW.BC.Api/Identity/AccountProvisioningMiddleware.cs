using RW.BC.Application.Accounts.Commands.EnsureAccountProvisioned;
using Wolverine;

namespace RW.BC.Api.Identity;

public sealed class AccountProvisioningMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IMessageBus bus)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            var uid = context.User.FindFirst(IdentityClaims.ExternalUserId)?.Value
                      ?? context.User.FindFirst(IdentityClaims.ExternalUserIdFallback)?.Value;
            var email = context.User.FindFirst(IdentityClaims.Email)?.Value;
            var displayName = context.User.FindFirst(IdentityClaims.DisplayName)?.Value;

            if (!string.IsNullOrEmpty(uid) && !string.IsNullOrEmpty(email))
            {
                await bus.InvokeAsync(
                    new EnsureAccountProvisionedCommand(uid, email, displayName),
                    context.RequestAborted);
            }
        }

        await next(context);
    }
}
