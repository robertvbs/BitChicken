using Gridify;
using Microsoft.EntityFrameworkCore;
using RW.BC.Application._Querying;
using RW.BC.Application.Forge.Dtos;
using RW.BC.Application.Forge.Ports;
using RW.BC.Application.Forge.Queries.GetAccountForgeRequests;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class ForgeRequestQueryService(DataContext context) : IForgeRequestQueryService
{
    public Task<PagedResponse<ForgeRequestDto>> QueryByBuyerAsync(
        string buyerAddress,
        IGridifyMapper<ForgeRequestRow> mapper,
        PagedRequest request,
        CancellationToken cancellationToken)
    {
        var query = context.Set<ForgeRequest>()
            .AsNoTracking()
            .Where(r => r.Buyer == buyerAddress)
            .Select(r => new ForgeRequestRow
            {
                RequestId = r.RequestId,
                Tier = r.Tier,
                Status = r.Status,
                TokenId = r.TokenId,
                EditionId = r.EditionId,
                BlockNumber = r.BlockNumber
            });

        return query.ToPagedResponseAsync(
            mapper,
            request,
            r => new ForgeRequestDto(
                r.RequestId.ToString(),
                r.Tier,
                r.Status,
                r.TokenId.HasValue ? r.TokenId.Value.ToString() : null,
                r.EditionId.HasValue ? r.EditionId.Value.ToString() : null,
                r.BlockNumber.ToString()),
            cancellationToken);
    }
}
