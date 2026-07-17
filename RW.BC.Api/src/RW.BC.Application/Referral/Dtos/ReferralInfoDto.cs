namespace RW.BC.Application.Referral.Dtos;

public sealed record ReferralInfoDto(
    string? Code,
    string? Upline,
    long ReferralCount,
    string Pending,
    string TotalAccrued,
    string TotalClaimed);
