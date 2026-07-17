using RW.BC.Application._Querying;
using RW.BC.Application.Marketplace.Dtos;
using RW.BC.Application.Marketplace.Ports;

namespace RW.BC.Application.Marketplace.Queries.GetListings;

public sealed class GetListingsHandler(IListingQueryService store, ListingGridifyMapper mapper)
{
    private const string DefaultOrderBy = "listedAtBlock desc";

    public async Task<PagedResponse<ListingDto>> Handle(
        GetListingsQuery query,
        CancellationToken cancellationToken)
    {
        var request = string.IsNullOrWhiteSpace(query.Request.OrderBy)
            ? query.Request with { OrderBy = DefaultOrderBy }
            : query.Request;

        return await store.QueryActiveAsync(mapper, request, cancellationToken);
    }
}
