using System.Diagnostics.CodeAnalysis;
using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Commands.LinkWallet;
using RW.BC.Application.Accounts.Commands.RequestWalletLinkNonce;
using RW.BC.Application.Accounts.Commands.UnlinkWallet;
using RW.BC.Application.Accounts.Dtos;
using RW.BC.Application.Accounts.Queries.GetMyAccount;
using RW.BC.Api.Web;
using Wolverine;

namespace RW.BC.Api.Endpoints;

[ExcludeFromCodeCoverage]
public static class AccountEndpoints
{
    public static void AddAccountEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/accounts").WithTags("Accounts");

        group.MapGet("/me", async (
                IMessageBus bus,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var query = new GetMyAccountQuery(currentUser.Id!);
                var result = await bus.InvokeAsync<AccountDto>(query, cancellationToken);
                return Results.Ok(result);
            })
            .RequireAuthorization()
            .WithName("GetMyAccount")
            .Produces<AccountDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/me/wallet/nonce", async (
                IMessageBus bus,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var command = new RequestWalletLinkNonceCommand(currentUser.Id!);
                var result = await bus.InvokeAsync<WalletLinkChallengeDto>(command, cancellationToken);
                return Results.Ok(result);
            })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitingExtensions.WalletLinkPolicy)
            .WithName("RequestWalletLinkNonce")
            .Produces<WalletLinkChallengeDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        group.MapPost("/me/wallet", async (
                IMessageBus bus,
                ICurrentUser currentUser,
                LinkWalletRequest request,
                CancellationToken cancellationToken) =>
            {
                var command = new LinkWalletCommand(currentUser.Id!, request.Address, request.Signature);
                var result = await bus.InvokeAsync<AccountDto>(command, cancellationToken);
                return Results.Ok(result);
            })
            .RequireAuthorization()
            .RequireRateLimiting(RateLimitingExtensions.WalletLinkPolicy)
            .WithName("LinkWallet")
            .Produces<AccountDto>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status410Gone)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity)
            .ProducesProblem(StatusCodes.Status429TooManyRequests);

        group.MapDelete("/me/wallet", async (
                IMessageBus bus,
                ICurrentUser currentUser,
                CancellationToken cancellationToken) =>
            {
                var command = new UnlinkWalletCommand(currentUser.Id!);
                var result = await bus.InvokeAsync<AccountDto>(command, cancellationToken);
                return Results.Ok(result);
            })
            .RequireAuthorization()
            .WithName("UnlinkWallet")
            .Produces<AccountDto>()
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status404NotFound);
    }
}
