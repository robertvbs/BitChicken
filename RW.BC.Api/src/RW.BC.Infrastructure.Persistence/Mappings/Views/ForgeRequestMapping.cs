using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class ForgeRequestMapping : IEntityTypeConfiguration<ForgeRequest>
{
    public void Configure(EntityTypeBuilder<ForgeRequest> builder)
    {
        builder.ToView("forge_requests", "indexer");
        builder.HasKey(r => r.RequestId);

        builder.Property(r => r.RequestId)
            .HasColumnName("request_id")
            .HasColumnType("numeric(78,0)")
;

        builder.Property(r => r.Buyer)
            .HasColumnName("buyer")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.Tier)
            .HasColumnName("tier")
            .HasColumnType("int4");

        builder.Property(r => r.Status)
            .HasColumnName("status")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.TokenId)
            .HasColumnName("token_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(r => r.EditionId)
            .HasColumnName("edition_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(r => r.BlockNumber)
            .HasColumnName("block_number")
            .HasColumnType("numeric(78,0)")
;

        builder.Property(r => r.FulfilledAtBlock)
            .HasColumnName("fulfilled_at_block")
            .HasColumnType("numeric(78,0)");
    }
}
