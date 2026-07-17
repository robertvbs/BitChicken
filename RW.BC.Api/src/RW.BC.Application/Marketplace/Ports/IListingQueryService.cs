using Gridify;
using RW.BC.Application._Querying;
using RW.BC.Application.Marketplace.Dtos;
using RW.BC.Application.Marketplace.Queries.GetListings;

namespace RW.BC.Application.Marketplace.Ports;

public interface IListingQueryService
{
    Task<PagedResponse<ListingDto>> QueryActiveAsync(
        IGridifyMapper<EnrichedListingRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken);
}
