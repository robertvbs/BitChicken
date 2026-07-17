using System.Text.RegularExpressions;

namespace RW.BC.Domain.BuildingBlocks;

public sealed record Email
{
    #region ORM

    private Email()
    {
    }

    #endregion

    private Email(string value)
    {
        Value = ValidateEmail(value).ToLowerInvariant();
    }

    public string Value { get; } = null!;

    public static Email Create(string value)
    {
        return new Email(value);
    }

    public override string ToString()
    {
        return Value;
    }

    private static string ValidateEmail(string email)
    {
        email.ThrowIfNullOrInvalid(ValueMinLength, ValueMaxLength);
        if (!EmailRegex.IsMatch(email)) throw new DomainException("Invalid email format.");
        return email;
    }

    #region Constants

    private const int ValueMinLength = 5;
    private const int ValueMaxLength = 320;

    private static readonly Regex EmailRegex = new(
        @"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        RegexOptions.Compiled);

    #endregion
}
