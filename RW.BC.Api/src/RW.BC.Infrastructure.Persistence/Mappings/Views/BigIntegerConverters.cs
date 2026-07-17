using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
internal static class BigIntegerConverters
{
    internal static readonly ValueConverter<long, decimal> Block =
        new(v => v, v => (long)v);
}
