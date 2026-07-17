using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Domain.Accounts;
using RW.BC.Infrastructure.Persistence.Mappings._Helpers;

namespace RW.BC.Infrastructure.Persistence.Mappings;

public sealed class WalletLinkNonceMapping : IEntityTypeConfiguration<WalletLinkNonce>
{
    public void Configure(EntityTypeBuilder<WalletLinkNonce> builder)
    {
        builder.ToTable("wallet_link_nonces");
        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id)
            .HasColumnName("account_id")
            .HasMaxLength(WalletLinkNonce.IdMaxLength)
            .HasColumnType($"varchar({WalletLinkNonce.IdMaxLength})")
            .ValueGeneratedNever();

        builder.Property(n => n.Nonce).IsRequired().HasMaxLength(WalletLinkNonce.NonceMaxLength);
        builder.Property(n => n.Message).IsRequired().HasMaxLength(WalletLinkNonce.MessageMaxLength);
        builder.Property(n => n.ExpiresAt).IsRequired();
        builder.Ignore(n => n.AccountId);

        builder.ConfigureAuditableFields();
    }
}
