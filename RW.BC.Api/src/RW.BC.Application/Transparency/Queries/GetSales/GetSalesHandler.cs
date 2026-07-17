using RW.BC.Application._Querying;
using RW.BC.Application.Transparency.Dtos;
using RW.BC.Application.Transparency.Ports;

namespace RW.BC.Application.Transparency.Queries.GetSales;

public sealed class GetSalesHandler(ISaleQueryService store, SaleGridifyMapper mapper)
{
    private const string DefaultOrderBy = "blockNumber desc";

    public async Task<PagedResponse<SaleDto>> Handle(
        GetSalesQuery query,
        CancellationToken cancellationToken)
    {
        var request = string.IsNullOrWhiteSpace(query.Request.OrderBy)
            ? query.Request with { OrderBy = DefaultOrderBy }
            : query.Request;

        return await store.QueryAsync(mapper, request, cancellationToken);
    }
}
