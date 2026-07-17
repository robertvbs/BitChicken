using System.Diagnostics.CodeAnalysis;
using RW.BC.Application._Querying;
using RW.BC.Application.Transparency.Dtos;
using RW.BC.Application.Transparency.Queries.GetSales;
using RW.BC.Application.Transparency.Queries.GetSummary;
using Wolverine;

namespace RW.BC.Api.Endpoints;

[ExcludeFromCodeCoverage]
public static class TransparencyEndpoints
{
    public static void AddTransparencyEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/transparency").WithTags("Transparency");

        group.MapGet("/sales", async (
                IMessageBus bus,
                int page = GridifyHardLimits.MinPage,
                int pageSize = GridifyHardLimits.DefaultPageSize,
                string? filter = null,
                string? orderBy = null,
                CancellationToken cancellationToken = default) =>
            {
                var query = new GetSalesQuery(new PagedRequest(page, pageSize, filter, orderBy));
                var result = await bus.InvokeAsync<PagedResponse<SaleDto>>(query, cancellationToken);
                return Results.Ok(result);
            })
            .WithName("GetSales")
            .Produces<PagedResponse<SaleDto>>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);

        group.MapGet("/summary", async (
                IMessageBus bus,
                CancellationToken cancellationToken = default) =>
            {
                var result = await bus.InvokeAsync<TransparencySummaryDto>(new GetSummaryQuery(), cancellationToken);
                return Results.Ok(result);
            })
            .WithName("GetTransparencySummary")
            .Produces<TransparencySummaryDto>()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
    }
}
