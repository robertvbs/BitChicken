using Gridify;

namespace RW.BC.Application.Editions.Queries.GetEditions;

public sealed class EditionGridifyMapper : GridifyMapper<EditionRow>
{
    public EditionGridifyMapper()
    {
        AddMap("id", r => r.EditionId);
        AddMap("name", r => r.Name);
        AddMap("rarity", r => r.Rarity);
        AddMap("active", r => r.Active);
        AddMap("distribution", r => r.Distribution);
    }
}
