using System.Diagnostics.CodeAnalysis;
using RW.BC.Application._Querying;
using RW.BC.Application.Forge.Dtos;
using RW.BC.Application.Forge.Queries.GetAccountForgeRequests;
using Wolverine;

namespace RW.BC.Api.Endpoints;

[ExcludeFromCodeCoverage]
public static class ForgeEndpoints
{
    public static void AddForgeEndpoints(this IEndpointRouteBuilder app)
    {
        var accounts = app.MapGroup("/accounts").WithTags("Accounts");

        accounts.MapGet("{address}/forge-requests", async (
                string address,
                IMessageBus bus,
                int page = GridifyHardLimits.MinPage,
                int pageSize = GridifyHardLimits.DefaultPageSize,
                string? filter = null,
                string? orderBy = null,
                CancellationToken cancellationToken = default) =>
            {
                var query = new GetAccountForgeRequestsQuery(address, new PagedRequest(page, pageSize, filter, orderBy));
                var result = await bus.InvokeAsync<PagedResponse<ForgeRequestDto>>(query, cancellationToken);
                return Results.Ok(result);
            })
            .WithName("GetAccountForgeRequests")
            .Produces<PagedResponse<ForgeRequestDto>>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
    }
}
