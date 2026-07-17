using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class MarketplaceListingMapping : IEntityTypeConfiguration<MarketplaceListing>
{
    public void Configure(EntityTypeBuilder<MarketplaceListing> builder)
    {
        builder.ToView("listings", "indexer");
        builder.HasKey(l => l.TokenId);

        builder.Property(l => l.TokenId)
            .HasColumnName("token_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(l => l.Seller)
            .HasColumnName("seller")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(l => l.Price)
            .HasColumnName("price")
            .HasColumnType("numeric(78,0)");

        builder.Property(l => l.Status)
            .HasColumnName("status")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(l => l.ListedAtBlock)
            .HasColumnName("listed_at_block")
            .HasColumnType("numeric(78,0)")
            .HasConversion(BigIntegerConverters.Block);
    }
}
