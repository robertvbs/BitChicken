using System.Diagnostics.CodeAnalysis;
using RW.BC.Application._Querying;
using RW.BC.Application.Marketplace.Dtos;
using RW.BC.Application.Marketplace.Queries.GetListings;
using Wolverine;

namespace RW.BC.Api.Endpoints;

[ExcludeFromCodeCoverage]
public static class MarketplaceEndpoints
{
    public static void AddMarketplaceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/marketplace").WithTags("Marketplace");

        group.MapGet("/listings", async (
                IMessageBus bus,
                int page = GridifyHardLimits.MinPage,
                int pageSize = GridifyHardLimits.DefaultPageSize,
                string? filter = null,
                string? orderBy = null,
                CancellationToken cancellationToken = default) =>
            {
                var query = new GetListingsQuery(new PagedRequest(page, pageSize, filter, orderBy));
                var result = await bus.InvokeAsync<PagedResponse<ListingDto>>(query, cancellationToken);
                return Results.Ok(result);
            })
            .WithName("GetListings")
            .Produces<PagedResponse<ListingDto>>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
    }
}
