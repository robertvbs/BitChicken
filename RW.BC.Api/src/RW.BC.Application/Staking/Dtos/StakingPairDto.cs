namespace RW.BC.Application.Staking.Dtos;

public sealed record StakingPairDto(
    string PairId,
    string MaleId,
    string FemaleId,
    bool Matched,
    string StakedAt,
    string LastClaimAt,
    string Status);
