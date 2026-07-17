using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class NftTokenMapping : IEntityTypeConfiguration<NftToken>
{
    public void Configure(EntityTypeBuilder<NftToken> builder)
    {
        builder.ToView("nfts", "indexer");
        builder.HasKey(n => n.TokenId);

        builder.Property(n => n.TokenId)
            .HasColumnName("token_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(n => n.EditionId)
            .HasColumnName("edition_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(n => n.Owner)
            .HasColumnName("owner")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(n => n.NftName)
            .HasColumnName("nft_name")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(n => n.Gender)
            .HasColumnName("gender")
            .HasColumnType("integer");

        builder.Property(n => n.Staked)
            .HasColumnName("staked")
            .HasColumnType("boolean");

        builder.Property(n => n.Burned)
            .HasColumnName("burned")
            .HasColumnType("boolean");
    }
}
