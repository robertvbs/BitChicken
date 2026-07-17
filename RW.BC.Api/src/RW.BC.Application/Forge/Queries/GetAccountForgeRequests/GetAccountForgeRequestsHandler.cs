using RW.BC.Application._Querying;
using RW.BC.Application.Forge.Dtos;
using RW.BC.Application.Forge.Ports;

namespace RW.BC.Application.Forge.Queries.GetAccountForgeRequests;

public sealed class GetAccountForgeRequestsHandler(
    IForgeRequestQueryService store,
    ForgeRequestGridifyMapper mapper)
{
    private const string DefaultOrderBy = "requestId desc";

    public async Task<PagedResponse<ForgeRequestDto>> Handle(
        GetAccountForgeRequestsQuery query,
        CancellationToken cancellationToken)
    {
        var request = string.IsNullOrWhiteSpace(query.Request.OrderBy)
            ? query.Request with { OrderBy = DefaultOrderBy }
            : query.Request;

        return await store.QueryByBuyerAsync(
            query.Address.ToLowerInvariant(),
            mapper,
            request,
            cancellationToken);
    }
}
