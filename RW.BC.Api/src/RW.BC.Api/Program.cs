using JasperFx.CodeGeneration;
using JasperFx.CodeGeneration.Model;
using JasperFx.RuntimeCompiler;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using RW.BC.Api.Endpoints;
using RW.BC.Api.Hubs;
using RW.BC.Api.Identity;
using RW.BC.Api.Realtime;
using RW.BC.Api.Web;
using RW.BC.Application._Extensions;
using RW.BC.Application.Abstractions;
using RW.BC.Infrastructure.Persistence;
using RW.BC.Infrastructure.Persistence._Extensions;
using RW.BC.ServiceDefaults;
using Wolverine;
using Wolverine.FluentValidation;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddFirebaseJwtBearer(builder.Configuration);

builder.Services.AddAuthorization();
builder.Services.AddAppCors(builder.Configuration);
builder.Services.AddAppRateLimiting(builder.Configuration);

builder.Services.AddRuntimeCompilation();
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton<ICurrentUser, HttpCurrentUser>();

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<FluentValidationExceptionHandler>();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();

builder.Services.AddSignalR();
builder.Services.AddSingleton<IListingsChangeDetector, ListingsChangeDetector>();
builder.Services.AddSingleton<IForgeFulfillmentDetector, ForgeFulfillmentDetector>();
builder.Services.AddHostedService<MarketplaceEventsListener>();

builder.Services.AddAppDocumentation();

builder.AddPersistenceInInfrastructure();
builder.AddApplication();

builder.Host.UseWolverine(opts =>
{
    opts.Durability.Mode = DurabilityMode.MediatorOnly;
    opts.ServiceLocationPolicy = ServiceLocationPolicy.AllowedButWarn;
    opts.UseFluentValidation(RegistrationBehavior.ExplicitRegistration);
    opts.Discovery.IncludeAssembly(typeof(RW.BC.Application._Extensions.DIExtension).Assembly);
    opts.CodeGeneration.TypeLoadMode = builder.Environment.IsProduction()
        ? TypeLoadMode.Auto
        : TypeLoadMode.Dynamic;
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    await using var migrationScope = app.Services.CreateAsyncScope();
    var ctx = migrationScope.ServiceProvider.GetRequiredService<DataContext>();
    await ctx.Database.MigrateAsync();
}

app.UseExceptionHandler();
if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseAppCors();
app.UseAppRateLimiting();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<AccountProvisioningMiddleware>();

app.MapDefaultEndpoints();
app.MapAppScalarApiReference();
app.MapHub<EventsHub>("/hubs/events");
app.AddAccountEndpoints();
app.AddMarketplaceEndpoints();
app.AddEditionsEndpoints();
app.AddNftsEndpoints();
app.AddStakingEndpoints();
app.AddForgeEndpoints();
app.AddTransparencyEndpoints();
app.AddReferralEndpoints();

app.Run();

public partial class Program;
