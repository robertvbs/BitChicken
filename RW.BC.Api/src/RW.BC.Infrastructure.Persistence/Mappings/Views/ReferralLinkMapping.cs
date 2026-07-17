using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class ReferralLinkMapping : IEntityTypeConfiguration<ReferralLink>
{
    public void Configure(EntityTypeBuilder<ReferralLink> builder)
    {
        builder.ToView("referral_links", "indexer");
        builder.HasKey(r => r.Buyer);

        builder.Property(r => r.Buyer)
            .HasColumnName("buyer")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.Referrer)
            .HasColumnName("referrer")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.BlockNumber)
            .HasColumnName("block_number")
            .HasColumnType("numeric(78,0)")
            .HasConversion(BigIntegerConverters.Block);
    }
}
