using RW.BC.Application._Querying;

namespace RW.BC.Application.Nfts.Queries.GetAccountNfts;

public sealed record GetAccountNftsQuery(string Address, PagedRequest Request);
