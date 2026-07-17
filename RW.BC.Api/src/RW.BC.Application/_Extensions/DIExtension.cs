using System.ComponentModel;
using System.Diagnostics.CodeAnalysis;
using System.Numerics;
using FluentValidation;
using Gridify;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using RW.BC.Application._Querying;
using RW.BC.Application.Editions.Queries.GetEditions;
using RW.BC.Application.Forge.Queries.GetAccountForgeRequests;
using RW.BC.Application.Marketplace.Queries.GetListings;
using RW.BC.Application.Nfts.Queries.GetAccountNfts;
using RW.BC.Application.Staking.Queries.GetAccountStaking;
using RW.BC.Application.Transparency.Queries.GetSales;

namespace RW.BC.Application._Extensions;

[ExcludeFromCodeCoverage]
public static class DIExtension
{
    public static void AddApplication(this IHostApplicationBuilder builder)
    {
        var assembly = typeof(AssemblyMarker).Assembly;
        builder.Services.AddValidatorsFromAssembly(assembly, ServiceLifetime.Singleton);
        builder.Services.AddGridify();
        builder.Services.AddMemoryCache();
        builder.Services.AddSingleton<ListingGridifyMapper>();
        builder.Services.AddSingleton<EditionGridifyMapper>();
        builder.Services.AddSingleton<NftGridifyMapper>();
        builder.Services.AddSingleton<StakingGridifyMapper>();
        builder.Services.AddSingleton<ForgeRequestGridifyMapper>();
        builder.Services.AddSingleton<SaleGridifyMapper>();
    }

    private static IServiceCollection AddGridify(this IServiceCollection services)
    {
        TypeDescriptor.AddAttributes(typeof(BigInteger), new TypeConverterAttribute(typeof(BigIntegerTypeConverter)));
        TypeDescriptor.AddAttributes(typeof(BigInteger?), new TypeConverterAttribute(typeof(NullableBigIntegerTypeConverter)));

        GridifyGlobalConfiguration.IgnoreNotMappedFields = false;
        GridifyGlobalConfiguration.CaseSensitiveMapper = false;
        GridifyGlobalConfiguration.DefaultPageSize = GridifyHardLimits.DefaultPageSize;

        services.TryAddSingleton<IValidator<PagedRequest>, PagedRequestValidator>();

        return services;
    }
}

file sealed class BigIntegerTypeConverter : TypeConverter
{
    public override bool CanConvertFrom(ITypeDescriptorContext? context, Type sourceType) =>
        sourceType == typeof(string) || base.CanConvertFrom(context, sourceType);

    public override object? ConvertFrom(ITypeDescriptorContext? context, System.Globalization.CultureInfo? culture, object value) =>
        value is string s ? BigInteger.Parse(s) : base.ConvertFrom(context, culture, value);
}

file sealed class NullableBigIntegerTypeConverter : TypeConverter
{
    public override bool CanConvertFrom(ITypeDescriptorContext? context, Type sourceType) =>
        sourceType == typeof(string) || base.CanConvertFrom(context, sourceType);

    public override object? ConvertFrom(ITypeDescriptorContext? context, System.Globalization.CultureInfo? culture, object value) =>
        value is string s && !string.IsNullOrEmpty(s) ? BigInteger.Parse(s) : null;
}
