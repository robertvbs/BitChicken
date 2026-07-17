using RW.BC.Application._Querying;
using RW.BC.Application.Nfts.Dtos;
using RW.BC.Application.Nfts.Ports;

namespace RW.BC.Application.Nfts.Queries.GetAccountNfts;

public sealed class GetAccountNftsHandler(INftQueryService store, NftGridifyMapper mapper)
{
    private const string DefaultOrderBy = "tokenId desc";

    public async Task<PagedResponse<NftItemDto>> Handle(
        GetAccountNftsQuery query,
        CancellationToken cancellationToken)
    {
        var request = string.IsNullOrWhiteSpace(query.Request.OrderBy)
            ? query.Request with { OrderBy = DefaultOrderBy }
            : query.Request;

        return await store.QueryByOwnerAsync(
            query.Address.ToLowerInvariant(),
            mapper,
            request,
            cancellationToken);
    }
}
