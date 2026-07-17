using System.Diagnostics.CodeAnalysis;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using Scalar.AspNetCore;

namespace RW.BC.Api.Web;

[ExcludeFromCodeCoverage]
public static class Documentation
{
    internal const string SchemeName = "Firebase";
    private const string Title = "RW.BC API";
    private const string Path = "/documentation";

    public static IServiceCollection AddAppDocumentation(this IServiceCollection services)
    {
        services.AddOpenApi(o =>
        {
            o.AddDocumentTransformer<SecuritySchemeTransformer>();
            o.AddOperationTransformer<AuthorizeOperationTransformer>();
        });

        return services;
    }

    public static WebApplication MapAppScalarApiReference(this WebApplication app)
    {
        app.MapOpenApi();
        app.MapScalarApiReference(Path, scalar =>
        {
            scalar.Title = Title;
            scalar.ForceDarkMode();
            scalar.EnablePersistentAuthentication();
            scalar.HideClientButton();
            scalar.AddPreferredSecuritySchemes(SchemeName);
        });

        return app;
    }
}

[ExcludeFromCodeCoverage]
internal sealed class SecuritySchemeTransformer : IOpenApiDocumentTransformer
{
    public Task TransformAsync(
        OpenApiDocument document,
        OpenApiDocumentTransformerContext context,
        CancellationToken cancellationToken)
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[Documentation.SchemeName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT"
        };

        return Task.CompletedTask;
    }
}

[ExcludeFromCodeCoverage]
internal sealed class AuthorizeOperationTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(
        OpenApiOperation operation,
        OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        var endpointMetadata = context.Description.ActionDescriptor.EndpointMetadata;
        var requiresAuth = false;
        var hasAllowAnonymous = false;

        foreach (var metadata in endpointMetadata)
            if (metadata is IAuthorizeData) requiresAuth = true;
            else if (metadata is IAllowAnonymous) hasAllowAnonymous = true;

        if (!requiresAuth || hasAllowAnonymous) return Task.CompletedTask;

        operation.Security ??= [];
        operation.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference(Documentation.SchemeName, context.Document)] = []
        });

        return Task.CompletedTask;
    }
}
