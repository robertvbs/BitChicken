using RW.BC.Application._Querying;

namespace RW.BC.Application.Forge.Queries.GetAccountForgeRequests;

public sealed record GetAccountForgeRequestsQuery(string Address, PagedRequest Request);
