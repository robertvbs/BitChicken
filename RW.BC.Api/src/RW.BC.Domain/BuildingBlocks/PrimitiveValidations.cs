using System.Runtime.CompilerServices;

namespace RW.BC.Domain.BuildingBlocks;

public static class PrimitiveValidations
{
    public static T ThrowIfNull<T>(
        this T? value,
        [CallerArgumentExpression(nameof(value))]
        string? param = null)
        where T : class
    {
        if (value is null)
            throw new DomainException($"{param} cannot be null.");
        return value;
    }

    public static string ThrowIfNullOrInvalid(
        this string? value,
        int minLength,
        int maxLength,
        [CallerArgumentExpression(nameof(value))]
        string? param = null)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainException($"{param} cannot be null or empty.");

        if (value.Length < minLength || value.Length > maxLength)
            throw new DomainException(
                $"{param} must be between {minLength} and {maxLength} characters.");

        return value;
    }
}
