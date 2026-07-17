namespace RW.BC.Application.Abstractions;

public sealed class InfrastructureException : Exception
{
    public InfrastructureException(string message) : base(message)
    {
    }

    public InfrastructureException(string message, Exception inner) : base(message, inner)
    {
    }
}
