namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class ReferralLink
{
    public string Buyer { get; init; } = string.Empty;
    public string Referrer { get; init; } = string.Empty;
    public long BlockNumber { get; init; }
}
