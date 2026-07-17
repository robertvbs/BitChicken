using RW.BC.Application.Editions.Queries.GetEditions;

namespace RW.BC.Application.Editions.Ports;

public interface IEditionQueryService
{
    Task<IReadOnlyList<EditionRow>> GetAllAsync(CancellationToken cancellationToken);
}
