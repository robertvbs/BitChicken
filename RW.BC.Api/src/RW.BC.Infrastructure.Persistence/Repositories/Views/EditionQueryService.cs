using Microsoft.EntityFrameworkCore;
using RW.BC.Application.Editions.Ports;
using RW.BC.Application.Editions.Queries.GetEditions;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Repositories.Views;

public sealed class EditionQueryService(DataContext context) : IEditionQueryService
{
    public async Task<IReadOnlyList<EditionRow>> GetAllAsync(CancellationToken cancellationToken)
    {
        return await context.Set<Edition>()
            .AsNoTracking()
            .Select(e => new EditionRow
            {
                EditionId = e.EditionId,
                Name = e.Name,
                ArtUri = e.ArtUri,
                Health = e.Health,
                Skill = e.Skill,
                Morale = e.Morale,
                Rarity = e.Rarity,
                Distribution = e.Distribution,
                MaxSupply = e.MaxSupply,
                Minted = e.Minted,
                MintStart = e.MintStart,
                MintEnd = e.MintEnd,
                Price = e.Price,
                Active = e.Active
            })
            .ToListAsync(cancellationToken);
    }
}
