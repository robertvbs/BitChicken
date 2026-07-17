using System.Diagnostics.CodeAnalysis;
using RW.BC.Application._Querying;
using RW.BC.Application.Nfts.Dtos;
using RW.BC.Application.Nfts.Queries.GetAccountNfts;
using Wolverine;

namespace RW.BC.Api.Endpoints;

[ExcludeFromCodeCoverage]
public static class NftsEndpoints
{
    public static void AddNftsEndpoints(this IEndpointRouteBuilder app)
    {
        var accounts = app.MapGroup("/accounts").WithTags("Accounts");

        accounts.MapGet("{address}/nfts", async (
                string address,
                IMessageBus bus,
                int page = GridifyHardLimits.MinPage,
                int pageSize = GridifyHardLimits.DefaultPageSize,
                string? filter = null,
                string? orderBy = null,
                CancellationToken cancellationToken = default) =>
            {
                var query = new GetAccountNftsQuery(address, new PagedRequest(page, pageSize, filter, orderBy));
                var result = await bus.InvokeAsync<PagedResponse<NftItemDto>>(query, cancellationToken);
                return Results.Ok(result);
            })
            .WithName("GetAccountNfts")
            .Produces<PagedResponse<NftItemDto>>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
    }
}
