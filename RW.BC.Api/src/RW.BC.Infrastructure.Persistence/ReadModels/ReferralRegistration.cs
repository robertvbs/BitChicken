using System.Numerics;

namespace RW.BC.Infrastructure.Persistence.ReadModels;

public sealed class ReferralRegistration
{
    public string Referrer { get; init; } = string.Empty;
    public BigInteger Code { get; init; }
    public long BlockNumber { get; init; }
}
