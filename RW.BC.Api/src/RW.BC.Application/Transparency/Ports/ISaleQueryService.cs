using Gridify;
using RW.BC.Application._Querying;
using RW.BC.Application.Transparency.Dtos;
using RW.BC.Application.Transparency.Queries.GetSales;

namespace RW.BC.Application.Transparency.Ports;

public interface ISaleQueryService
{
    Task<PagedResponse<SaleDto>> QueryAsync(
        IGridifyMapper<SaleRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken);
}
