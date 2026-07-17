namespace RW.BC.Domain.BuildingBlocks;

public interface IAuditable
{
    DateTimeOffset CreatedAt { get; }
    DateTimeOffset? UpdatedAt { get; }
    void SetCreationTimestamp();
    void SetUpdateTimestamp();
}
