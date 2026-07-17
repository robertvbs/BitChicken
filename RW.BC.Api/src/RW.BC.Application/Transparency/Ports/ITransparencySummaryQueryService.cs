namespace RW.BC.Application.Transparency.Ports;

public interface ITransparencySummaryQueryService
{
    Task<long> GetSalesCountAsync(CancellationToken cancellationToken);
    Task<string> GetTotalVolumeAsync(CancellationToken cancellationToken);
    Task<long> GetNftCountAsync(CancellationToken cancellationToken);
    Task<long> GetEditionCountAsync(CancellationToken cancellationToken);
    Task<string> GetTotalBcknTransferredAsync(CancellationToken cancellationToken);
}
