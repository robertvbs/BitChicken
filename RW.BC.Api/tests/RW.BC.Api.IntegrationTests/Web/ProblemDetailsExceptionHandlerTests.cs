using System.IO;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.WalletLink;
using RW.BC.Api.Web;
using RW.BC.Domain.BuildingBlocks;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Web;

public sealed class ProblemDetailsExceptionHandlerTests
{
    private static (ProblemDetailsExceptionHandler Handler, HttpContext Context, MemoryStream Body) CreateSut()
    {
        var handler = new ProblemDetailsExceptionHandler();
        var body = new MemoryStream();
        var context = new DefaultHttpContext();
        context.Response.Body = body;
        context.Request.Path = "/test";
        return (handler, context, body);
    }

    private static ProblemDetails ReadResponse(MemoryStream body)
    {
        body.Position = 0;
        return JsonSerializer.Deserialize<ProblemDetails>(body)!;
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn410_ForWalletLinkNonceUnavailableException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new WalletLinkNonceUnavailableException("nonce gone"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status410Gone);
        var problem = ReadResponse(body);
        problem.Detail.Should().Be("nonce gone");
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn422_ForWalletLinkSignatureInvalidException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new WalletLinkSignatureInvalidException("bad sig"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status422UnprocessableEntity);
        var problem = ReadResponse(body);
        problem.Detail.Should().Be("bad sig");
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn409_ForWalletAlreadyLinkedException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new WalletAlreadyLinkedException("already linked"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        var problem = ReadResponse(body);
        problem.Detail.Should().Be("already linked");
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn409_ForConflictException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new ConflictException("duplicate"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status409Conflict);
        var problem = ReadResponse(body);
        problem.Detail.Should().Be("duplicate");
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn404_ForNotFoundException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new NotFoundException("Account", "uid-123"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status404NotFound);
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn422_ForDomainException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new DomainException("invariant violated"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status422UnprocessableEntity);
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn503_ForInfrastructureException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new InfrastructureException("db failure"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn400_ForGenericAppException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new ConcreteAppException("app-level error"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status400BadRequest);
        var problem = ReadResponse(body);
        problem.Detail.Should().Be("app-level error");
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn403_ForUnauthorizedAccessException()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new UnauthorizedAccessException("access denied"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status403Forbidden);
        var problem = ReadResponse(body);
        problem.Detail.Should().Be("access denied");
    }

    [Fact]
    public async Task TryHandleAsync_ShouldReturn500_ForUnhandledExceptions()
    {
        var (handler, context, body) = CreateSut();

        var handled = await handler.TryHandleAsync(
            context,
            new InvalidOperationException("unexpected"),
            CancellationToken.None);

        handled.Should().BeTrue();
        context.Response.StatusCode.Should().Be(StatusCodes.Status500InternalServerError);
    }

    private sealed class ConcreteAppException(string message) : AppException(message);
}
