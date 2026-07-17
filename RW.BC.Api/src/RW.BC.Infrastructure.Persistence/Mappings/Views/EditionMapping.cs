using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class EditionMapping : IEntityTypeConfiguration<Edition>
{
    public void Configure(EntityTypeBuilder<Edition> builder)
    {
        builder.ToView("editions", "indexer");
        builder.HasKey(e => e.EditionId);

        builder.Property(e => e.EditionId)
            .HasColumnName("edition_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(e => e.Name)
            .HasColumnName("name")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(e => e.ArtUri)
            .HasColumnName("art_uri")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(e => e.Health)
            .HasColumnName("health")
            .HasColumnType("integer");

        builder.Property(e => e.Skill)
            .HasColumnName("skill")
            .HasColumnType("integer");

        builder.Property(e => e.Morale)
            .HasColumnName("morale")
            .HasColumnType("integer");

        builder.Property(e => e.Rarity)
            .HasColumnName("rarity")
            .HasColumnType("integer");

        builder.Property(e => e.Distribution)
            .HasColumnName("distribution")
            .HasColumnType("integer");

        builder.Property(e => e.MaxSupply)
            .HasColumnName("max_supply")
            .HasColumnType("numeric(78,0)")
;

        builder.Property(e => e.Minted)
            .HasColumnName("minted")
            .HasColumnType("numeric(78,0)")
;

        builder.Property(e => e.MintStart)
            .HasColumnName("mint_start")
            .HasColumnType("numeric(78,0)")
;

        builder.Property(e => e.MintEnd)
            .HasColumnName("mint_end")
            .HasColumnType("numeric(78,0)")
;

        builder.Property(e => e.Price)
            .HasColumnName("price")
            .HasColumnType("numeric(78,0)")
;

        builder.Property(e => e.Active)
            .HasColumnName("active")
            .HasColumnType("boolean");
    }
}
