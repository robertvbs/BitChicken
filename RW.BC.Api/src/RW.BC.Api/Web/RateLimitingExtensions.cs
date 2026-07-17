using System.Diagnostics.CodeAnalysis;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace RW.BC.Api.Web;

public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    public GlobalWindowOptions Global { get; init; } = new();
    public WalletPolicyOptions WalletPolicy { get; init; } = new();

    public sealed class GlobalWindowOptions
    {
        public int PermitLimit { get; init; } = 100;
        public int WindowSeconds { get; init; } = 10;
        public int QueueLimit { get; init; } = 0;
    }

    public sealed class WalletPolicyOptions
    {
        public string PolicyName { get; init; } = RateLimitingExtensions.WalletLinkPolicy;
        public int PermitLimit { get; init; } = 5;
        public int WindowSeconds { get; init; } = 60;
        public int QueueLimit { get; init; } = 0;
    }
}

public static class RateLimitingExtensions
{
    public const string WalletLinkPolicy = "wallet-link";

    public static IServiceCollection AddAppRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<RateLimitingOptions>(
            configuration.GetSection(RateLimitingOptions.SectionName));

        services.AddRateLimiter(limiter =>
        {
            var opts = configuration
                .GetSection(RateLimitingOptions.SectionName)
                .Get<RateLimitingOptions>() ?? new RateLimitingOptions();

            limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
            {
                var key = ctx.Connection.RemoteIpAddress?.ToString()
                          ?? ctx.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                          ?? "unknown";

                return RateLimitPartition.GetFixedWindowLimiter(key, _ =>
                    new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = opts.Global.PermitLimit,
                        Window = TimeSpan.FromSeconds(opts.Global.WindowSeconds),
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                        QueueLimit = opts.Global.QueueLimit
                    });
            });

            limiter.AddFixedWindowLimiter(opts.WalletPolicy.PolicyName, o =>
            {
                o.PermitLimit = opts.WalletPolicy.PermitLimit;
                o.Window = TimeSpan.FromSeconds(opts.WalletPolicy.WindowSeconds);
                o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
                o.QueueLimit = opts.WalletPolicy.QueueLimit;
            });

            limiter.OnRejected = async (context, cancellationToken) =>
            {
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;

                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString();

                var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = StatusCodes.Status429TooManyRequests,
                    Title = "Too many requests",
                    Detail = "You have exceeded the allowed request rate. Please slow down.",
                    Instance = context.HttpContext.Request.Path
                };

                await context.HttpContext.Response.WriteAsJsonAsync(
                    problem,
                    JsonDefaults.Options,
                    "application/problem+json",
                    cancellationToken);
            };
        });

        return services;
    }

    [ExcludeFromCodeCoverage]
    public static WebApplication UseAppRateLimiting(this WebApplication app)
    {
        app.UseRateLimiter();
        return app;
    }
}
