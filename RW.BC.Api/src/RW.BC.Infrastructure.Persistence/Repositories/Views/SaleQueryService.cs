using Gridify;
using Microsoft.EntityFrameworkCore;
using RW.BC.Application._Querying;
using RW.BC.Application.Transparency.Dtos;
using RW.BC.Application.Transparency.Ports;
using RW.BC.Application.Transparency.Queries.GetSales;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class SaleQueryService(DataContext context) : ISaleQueryService
{
    public Task<PagedResponse<SaleDto>> QueryAsync(
        IGridifyMapper<SaleRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken)
    {
        var query = context.Set<Sale>().AsNoTracking().Select(s => new SaleRow
        {
            TokenId = s.TokenId,
            Seller = s.Seller,
            Buyer = s.Buyer,
            Price = s.Price,
            PlatformFee = s.PlatformFee,
            Royalty = s.Royalty,
            BlockNumber = s.BlockNumber
        });

        return query.ToPagedResponseAsync(
            mapper,
            request,
            r => new SaleDto(
                r.TokenId.ToString(),
                r.Seller,
                r.Buyer,
                r.Price.ToString(),
                r.PlatformFee.ToString(),
                r.Royalty.ToString(),
                r.BlockNumber),
            cancellationToken);
    }
}
