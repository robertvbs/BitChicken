using System.Numerics;
using RW.BC.Application.Referral.Dtos;
using RW.BC.Application.Referral.Ports;

namespace RW.BC.Application.Referral.Queries.GetReferralInfo;

public sealed class GetReferralInfoHandler(IReferralQueryService store)
{
    public async Task<ReferralInfoDto> Handle(
        GetReferralInfoQuery query,
        CancellationToken cancellationToken)
    {
        var address = query.Address.ToLowerInvariant();

        var code = await store.GetRegistrationCodeAsync(address, cancellationToken);
        var upline = await store.GetUplineAsync(address, cancellationToken);
        var referralCount = await store.GetReferralCountAsync(address, cancellationToken);
        var totalAccruedStr = await store.GetTotalAccruedAsync(address, cancellationToken);
        var totalClaimedStr = await store.GetTotalClaimedAsync(address, cancellationToken);

        var totalAccrued = BigInteger.TryParse(totalAccruedStr, out var accrued) ? accrued : BigInteger.Zero;
        var totalClaimed = BigInteger.TryParse(totalClaimedStr, out var claimed) ? claimed : BigInteger.Zero;
        var pending = totalAccrued - totalClaimed;

        return new ReferralInfoDto(
            Code: code,
            Upline: upline,
            ReferralCount: referralCount,
            Pending: pending.ToString(),
            TotalAccrued: totalAccrued.ToString(),
            TotalClaimed: totalClaimed.ToString());
    }
}
