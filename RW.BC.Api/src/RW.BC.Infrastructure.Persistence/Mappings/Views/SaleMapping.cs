using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class SaleMapping : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.ToView("sales", "indexer");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(s => s.TokenId)
            .HasColumnName("token_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(s => s.Seller)
            .HasColumnName("seller")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(s => s.Buyer)
            .HasColumnName("buyer")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(s => s.Price)
            .HasColumnName("price")
            .HasColumnType("numeric(78,0)");

        builder.Property(s => s.PlatformFee)
            .HasColumnName("platform_fee")
            .HasColumnType("numeric(78,0)");

        builder.Property(s => s.Royalty)
            .HasColumnName("royalty")
            .HasColumnType("numeric(78,0)");

        builder.Property(s => s.BlockNumber)
            .HasColumnName("block_number")
            .HasColumnType("numeric(78,0)")
            .HasConversion(BigIntegerConverters.Block);
    }
}
