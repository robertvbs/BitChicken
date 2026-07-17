using Gridify;
using RW.BC.Application._Querying;
using RW.BC.Application.Forge.Dtos;
using RW.BC.Application.Forge.Queries.GetAccountForgeRequests;

namespace RW.BC.Application.Forge.Ports;

public interface IForgeRequestQueryService
{
    Task<PagedResponse<ForgeRequestDto>> QueryByBuyerAsync(
        string buyerAddress,
        IGridifyMapper<ForgeRequestRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken);
}
