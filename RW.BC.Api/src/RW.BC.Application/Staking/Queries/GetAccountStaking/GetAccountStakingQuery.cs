using RW.BC.Application._Querying;

namespace RW.BC.Application.Staking.Queries.GetAccountStaking;

public sealed record GetAccountStakingQuery(string Address, PagedRequest Request);
