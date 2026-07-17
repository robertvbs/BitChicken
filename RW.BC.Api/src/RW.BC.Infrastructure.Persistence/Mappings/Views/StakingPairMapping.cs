using System.Diagnostics.CodeAnalysis;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Infrastructure.Persistence.ReadModels;

namespace RW.BC.Infrastructure.Persistence.Mappings.Views;

[ExcludeFromCodeCoverage]
public sealed class StakingPairMapping : IEntityTypeConfiguration<StakingPair>
{
    public void Configure(EntityTypeBuilder<StakingPair> builder)
    {
        builder.ToView("staking_pairs", "indexer");
        builder.HasKey(p => p.PairId);

        builder.Property(p => p.PairId)
            .HasColumnName("pair_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(p => p.Staker)
            .HasColumnName("staker")
            .HasColumnType("text")
            .IsRequired();

        builder.Property(p => p.MaleId)
            .HasColumnName("male_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(p => p.FemaleId)
            .HasColumnName("female_id")
            .HasColumnType("numeric(78,0)");

        builder.Property(p => p.Matched)
            .HasColumnName("matched")
            .HasColumnType("boolean");

        builder.Property(p => p.StakedAt)
            .HasColumnName("staked_at")
            .HasColumnType("numeric(78,0)");

        builder.Property(p => p.LastClaimAt)
            .HasColumnName("last_claim_at")
            .HasColumnType("numeric(78,0)");

        builder.Property(p => p.Status)
            .HasColumnName("status")
            .HasColumnType("text")
            .IsRequired();
    }
}
