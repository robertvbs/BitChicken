using Gridify;
using RW.BC.Application._Querying;
using RW.BC.Application.Nfts.Dtos;
using RW.BC.Application.Nfts.Queries.GetAccountNfts;

namespace RW.BC.Application.Nfts.Ports;

public interface INftQueryService
{
    Task<PagedResponse<NftItemDto>> QueryByOwnerAsync(
        string ownerAddress,
        IGridifyMapper<EnrichedNftRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken);
}
