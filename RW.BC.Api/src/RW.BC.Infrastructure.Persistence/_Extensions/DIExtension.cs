using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using RW.BC.Application.Abstractions;
using RW.BC.Application.Accounts.Ports;
using RW.BC.Application.Editions.Ports;
using RW.BC.Application.Forge.Ports;
using RW.BC.Application.Marketplace.Ports;
using RW.BC.Application.Nfts.Ports;
using RW.BC.Application.Referral.Ports;
using RW.BC.Application.Staking.Ports;
using RW.BC.Application.Transparency.Ports;
using RW.BC.Infrastructure.Persistence.Repositories;
using RW.BC.Infrastructure.Persistence.Repositories.Views;
using RW.BC.Infrastructure.Persistence.Security;

namespace RW.BC.Infrastructure.Persistence._Extensions;

[ExcludeFromCodeCoverage]
public static class DIExtension
{
    public const string MigrationsHistoryTable = "_migrations_history";
    public const string SchemaName = "public";
    public const string ConnectionStringName = "bitchicken";

    public static void AddPersistenceInInfrastructure(this IHostApplicationBuilder builder)
    {
        builder.AddNpgsqlDbContext<DataContext>(ConnectionStringName, configureDbContextOptions: opts =>
        {
            opts.UseSnakeCaseNamingConvention();
            opts.UseNpgsql(npg =>
            {
                npg.MigrationsHistoryTable(MigrationsHistoryTable, SchemaName);
                npg.EnableRetryOnFailure(3, TimeSpan.FromSeconds(5), null);
            });
            opts.AddInterceptors(new AuditingInterceptor());
        });

        builder.Services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<DataContext>());
        builder.Services.AddScoped<IAccountRepository, AccountRepository>();
        builder.Services.AddScoped<IWalletLinkNonceRepository, WalletLinkNonceRepository>();
        builder.Services.AddScoped<IListingQueryService, ListingQueryService>();
        builder.Services.AddScoped<IEditionQueryService, EditionQueryService>();
        builder.Services.AddScoped<INftQueryService, NftQueryService>();
        builder.Services.AddScoped<IStakingQueryService, StakingQueryService>();
        builder.Services.AddScoped<IForgeRequestQueryService, ForgeRequestQueryService>();
        builder.Services.AddScoped<ISaleQueryService, SaleQueryService>();
        builder.Services.AddScoped<ITransparencySummaryQueryService, TransparencySummaryQueryService>();
        builder.Services.AddScoped<IReferralQueryService, ReferralQueryService>();
        builder.Services.AddSingleton<ISignatureVerifier, NethereumSignatureVerifier>();
    }
}
