using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.WalletLink;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Api.Web;

public sealed class ProblemDetailsExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            WalletLinkNonceUnavailableException => (StatusCodes.Status410Gone, "Wallet link challenge expired or unavailable"),
            WalletLinkSignatureInvalidException => (StatusCodes.Status422UnprocessableEntity, "Wallet signature invalid"),
            WalletAlreadyLinkedException => (StatusCodes.Status409Conflict, "Wallet already linked"),
            ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            NotFoundException => (StatusCodes.Status404NotFound, "Resource not found"),
            DomainException => (StatusCodes.Status422UnprocessableEntity, "Domain rule violation"),
            AppException => (StatusCodes.Status400BadRequest, "Application error"),
            InfrastructureException => (StatusCodes.Status503ServiceUnavailable, "Infrastructure failure"),
            UnauthorizedAccessException => (StatusCodes.Status403Forbidden, "Forbidden"),
            _ => (StatusCodes.Status500InternalServerError, "Unexpected error")
        };

        var problem = new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = exception.Message,
            Instance = httpContext.Request.Path
        };

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(
            problem,
            JsonDefaults.Options,
            "application/problem+json",
            cancellationToken);
        return true;
    }
}
