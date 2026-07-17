namespace RW.BC.Application.Abstractions;

public sealed class ConflictException(string message, string? constraintName = null) : Exception(message)
{
    public string? ConstraintName { get; } = constraintName;
}
