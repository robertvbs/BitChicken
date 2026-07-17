using System.Linq.Expressions;
using Gridify;
using Microsoft.EntityFrameworkCore;
using RW.BC.Application._Querying;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

internal static class GridifyQueryExtensions
{
    internal static async Task<PagedResponse<TDto>> ToPagedResponseAsync<TEntity, TDto>(
        this IQueryable<TEntity> source,
        IGridifyMapper<TEntity> mapper,
        PagedRequest request,
        Expression<Func<TEntity, TDto>> projection,
        CancellationToken cancellationToken)
        where TEntity : class
    {
        var gridifyQuery = new GridifyQuery
        {
            Filter = string.IsNullOrWhiteSpace(request.Filter) ? null : request.Filter,
            OrderBy = string.IsNullOrWhiteSpace(request.OrderBy) ? null : request.OrderBy,
            Page = request.Page,
            PageSize = request.PageSize
        };

        var filtered = source.AsNoTracking().ApplyFiltering(gridifyQuery, mapper);
        var count = await filtered.CountAsync(cancellationToken);
        if (count == 0)
            return new PagedResponse<TDto>([], 0, request.Page, request.PageSize);

        var paged = filtered.ApplyOrdering(gridifyQuery, mapper).ApplyPaging(gridifyQuery);
        var data = await paged.Select(projection).ToListAsync(cancellationToken);

        return new PagedResponse<TDto>(data, count, request.Page, request.PageSize);
    }
}
