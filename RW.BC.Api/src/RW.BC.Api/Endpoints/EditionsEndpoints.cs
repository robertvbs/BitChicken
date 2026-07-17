using System.Diagnostics.CodeAnalysis;
using RW.BC.Application._Querying;
using RW.BC.Application.Editions.Dtos;
using RW.BC.Application.Editions.Queries.GetEditions;
using Wolverine;

namespace RW.BC.Api.Endpoints;

[ExcludeFromCodeCoverage]
public static class EditionsEndpoints
{
    public static void AddEditionsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/editions").WithTags("Editions");

        group.MapGet(string.Empty, async (
                IMessageBus bus,
                int page = GridifyHardLimits.MinPage,
                int pageSize = GridifyHardLimits.DefaultPageSize,
                string? filter = null,
                string? orderBy = null,
                CancellationToken cancellationToken = default) =>
            {
                var query = new GetEditionsQuery(new PagedRequest(page, pageSize, filter, orderBy));
                var result = await bus.InvokeAsync<PagedResponse<EditionDto>>(query, cancellationToken);
                return Results.Ok(result);
            })
            .WithName("GetEditions")
            .Produces<PagedResponse<EditionDto>>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
    }
}
