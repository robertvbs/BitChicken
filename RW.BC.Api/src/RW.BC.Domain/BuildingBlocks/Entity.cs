namespace RW.BC.Domain.BuildingBlocks;

public abstract class Entity<TKey> where TKey : notnull
{
    protected Entity(TKey id)
    {
        Id = id;
    }

    public TKey Id { get; protected set; }

    public override bool Equals(object? obj)
    {
        return obj is Entity<TKey> other && other.GetType() == GetType() &&
               EqualityComparer<TKey>.Default.Equals(other.Id, Id);
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(GetType(), Id);
    }
}
