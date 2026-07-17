using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RW.BC.Domain.Accounts;
using RW.BC.Infrastructure.Persistence.Mappings._Helpers;

namespace RW.BC.Infrastructure.Persistence.Mappings;

public sealed class AccountMapping : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id)
            .HasMaxLength(Account.IdMaxLength)
            .HasColumnType($"varchar({Account.IdMaxLength})")
            .ValueGeneratedNever();

        builder.Property(a => a.Nickname).IsRequired().HasMaxLength(Account.NicknameMaxLength);
        builder.Property(a => a.Status).HasConversion<string>().IsRequired();
        builder.Property(a => a.WalletAddress).HasMaxLength(42);
        builder.Property(a => a.WalletLinkedAt);
        builder.Ignore(a => a.WalletLinked);

        builder.OwnsOne(a => a.Email, email =>
        {
            email.Property(e => e.Value).HasColumnName("email").IsRequired().HasMaxLength(320);
            email.HasIndex(e => e.Value).IsUnique();
        });

        builder.HasIndex(a => a.WalletAddress).IsUnique();
        builder.ConfigureAuditableFields();
    }
}
