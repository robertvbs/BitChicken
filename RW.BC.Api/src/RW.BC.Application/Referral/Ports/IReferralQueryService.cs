namespace RW.BC.Application.Referral.Ports;

public interface IReferralQueryService
{
    Task<string?> GetRegistrationCodeAsync(string address, CancellationToken cancellationToken);
    Task<string?> GetUplineAsync(string address, CancellationToken cancellationToken);
    Task<long> GetReferralCountAsync(string address, CancellationToken cancellationToken);
    Task<string> GetTotalAccruedAsync(string address, CancellationToken cancellationToken);
    Task<string> GetTotalClaimedAsync(string address, CancellationToken cancellationToken);
}
