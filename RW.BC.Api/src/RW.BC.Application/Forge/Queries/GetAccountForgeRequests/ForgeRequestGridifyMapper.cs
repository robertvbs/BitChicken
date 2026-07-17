using Gridify;

namespace RW.BC.Application.Forge.Queries.GetAccountForgeRequests;

public sealed class ForgeRequestGridifyMapper : GridifyMapper<ForgeRequestRow>
{
    public ForgeRequestGridifyMapper()
    {
        AddMap("status", r => r.Status);
        AddMap("tier", r => r.Tier);
        AddMap("requestId", r => r.RequestId);
    }
}
