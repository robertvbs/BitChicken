namespace RW.BC.Application.Abstractions;

public sealed class NotFoundException(string resourceName, object key)
    : Exception($"{resourceName} '{key}' not found.");
