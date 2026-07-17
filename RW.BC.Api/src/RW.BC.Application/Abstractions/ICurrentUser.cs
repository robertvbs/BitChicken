namespace RW.BC.Application.Abstractions;

public interface ICurrentUser
{
    string? Id { get; }
    string? DisplayName { get; }
}
