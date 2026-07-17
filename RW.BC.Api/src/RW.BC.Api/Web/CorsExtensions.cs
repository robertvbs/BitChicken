using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.Configuration;

namespace RW.BC.Api.Web;

public static class CorsExtensions
{
    public const string PolicyName = "RW.BC.Api.Cors";
    public const string DefaultSection = "Cors";

    public static IServiceCollection AddAppCors(
        this IServiceCollection services,
        IConfiguration configuration,
        string sectionName = DefaultSection)
    {
        var section = configuration.GetSection(sectionName);
        var origins = section.GetSection("Origins").Get<string[]>() ?? [];
        var hostSuffixes = section.GetSection("AllowedHostSuffixes").Get<string[]>() ?? [];

        services.AddCors(options => options.AddPolicy(PolicyName, policy =>
        {
            if (hostSuffixes.Length > 0)
                policy.SetIsOriginAllowed(origin => IsOriginAllowed(origin, origins, hostSuffixes));
            else if (origins.Length > 0)
                policy.WithOrigins(origins);

            policy.AllowAnyMethod();
            policy.WithHeaders("Content-Type", "Authorization", "x-requested-with", "x-signalr-user-agent");
            policy.AllowCredentials();
        }));

        return services;
    }

    [ExcludeFromCodeCoverage]
    public static WebApplication UseAppCors(this WebApplication app)
    {
        app.UseCors(PolicyName);
        return app;
    }

    public static bool IsOriginAllowed(string origin, string[] explicitOrigins, string[] hostSuffixes)
    {
        if (explicitOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
            return true;

        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
            return false;

        return hostSuffixes.Any(suffix =>
        {
            var normalized = suffix.StartsWith('.') ? suffix : "." + suffix;
            var bare = normalized.TrimStart('.');
            return uri.Host.Equals(bare, StringComparison.OrdinalIgnoreCase)
                   || uri.Host.EndsWith(normalized, StringComparison.OrdinalIgnoreCase);
        });
    }
}
