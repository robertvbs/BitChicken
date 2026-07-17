using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Infrastructure.Persistence.Mappings._Helpers;

public static class AuditableConfigurationExtensions
{
    public static EntityTypeBuilder<T> ConfigureAuditableFields<T>(this EntityTypeBuilder<T> builder)
        where T : class, IAuditable
    {
        builder.Property("CreatedAt").IsRequired();
        builder.Property("UpdatedAt").IsRequired(false);
        return builder;
    }
}
