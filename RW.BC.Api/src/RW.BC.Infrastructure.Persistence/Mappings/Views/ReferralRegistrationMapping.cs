using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class ReferralRegistrationMapping : IEntityTypeConfiguration<ReferralRegistration>
{
    public void Configure(EntityTypeBuilder<ReferralRegistration> builder)
    {
        builder.ToView("referral_registrations", "indexer");
        builder.HasKey(r => r.Referrer);

        builder.Property(r => r.Referrer)
            .HasColumnName("referrer")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(r => r.Code)
            .HasColumnName("code")
            .HasColumnType("numeric(78,0)");

        builder.Property(r => r.BlockNumber)
            .HasColumnName("block_number")
            .HasColumnType("numeric(78,0)")
            .HasConversion(BigIntegerConverters.Block);
    }
}
