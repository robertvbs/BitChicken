using Microsoft.EntityFrameworkCore;
using RW.BC.Application.Abstractions;
using RW.BC.Domain.Accounts;
using RW.BC.Domain.Accounts.Enums;
using RW.BC.Domain.BuildingBlocks;
using RW.BC.Infrastructure.Persistence.Repositories;

namespace RW.BC.Infrastructure.Persistence.IntegrationTests;

[Collection("Database")]
public sealed class PersistenceTests(PostgreSqlFixture fixture)
{
    private static string NewUid() => "firebase-uid-" + Guid.NewGuid().ToString("N")[..16];
    private static string NewEmail() => $"user-{Guid.NewGuid():N}@example.com";
    private static string NewWallet() => "0x" + Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N")[..8];

    private static Account MakeAccount(string? email = null, string nickname = "Tester_1") =>
        Account.Create(NewUid(), Email.Create(email ?? NewEmail()), nickname);

    // ───────────────────────── DataContext ─────────────────────────

    [Fact]
    public async Task CommitAsync_ShouldThrowConflictException_OnUniqueEmailViolation()
    {
        var email = NewEmail();
        await using (var ctx = fixture.NewDbContext())
        {
            await ctx.Set<Account>().AddAsync(MakeAccount(email: email));
            await ((IUnitOfWork)ctx).CommitAsync(CancellationToken.None);
        }

        await using var ctx2 = fixture.NewDbContext();
        await ctx2.Set<Account>().AddAsync(MakeAccount(email: email));
        await Assert.ThrowsAsync<ConflictException>(() => ((IUnitOfWork)ctx2).CommitAsync(CancellationToken.None));
    }

    [Fact]
    public async Task AuditingInterceptor_ShouldSetCreatedAt_OnInsert()
    {
        var account = MakeAccount();
        await using var ctx = fixture.NewDbContext();
        await ctx.Set<Account>().AddAsync(account);
        await ctx.CommitAsync();

        await using var verify = fixture.NewDbContext();
        var loaded = await verify.Set<Account>().FindAsync(account.Id);
        loaded!.CreatedAt.Should().NotBe(default);
        loaded.UpdatedAt.Should().BeNull();
    }

    [Fact]
    public async Task AuditingInterceptor_ShouldSetUpdatedAt_OnUpdate()
    {
        var account = MakeAccount();
        await using (var ctx = fixture.NewDbContext())
        {
            await ctx.Set<Account>().AddAsync(account);
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            var repo = new AccountRepository(ctx);
            var loaded = await repo.GetByIdAsync(account.Id);
            loaded!.LinkWallet("0x1234567890123456789012345678901234567890");
            repo.Update(loaded);
            await ctx.CommitAsync();
        }

        await using var verify = fixture.NewDbContext();
        var updated = await verify.Set<Account>().FindAsync(account.Id);
        updated!.UpdatedAt.Should().NotBeNull();
    }

    // ───────────────────────── AccountRepository ─────────────────────────

    [Fact]
    public async Task AccountRepository_ExistsByEmailAsync_ShouldReturnTrue_WhenEmailExists()
    {
        var email = NewEmail();
        var account = MakeAccount(email: email);

        await using (var ctx = fixture.NewDbContext())
        {
            await new AccountRepository(ctx).AddAsync(account);
            await ctx.CommitAsync();
        }

        await using var verify = fixture.NewDbContext();
        var repo = new AccountRepository(verify);
        (await repo.ExistsByEmailAsync(email)).Should().BeTrue();
        (await repo.ExistsByEmailAsync("nobody@example.com")).Should().BeFalse();
    }

    [Fact]
    public async Task AccountRepository_ShouldRoundTrip_AndExposeAllMappedFields()
    {
        var email = NewEmail();
        var wallet = NewWallet();
        var account = MakeAccount(email: email);

        await using (var ctx = fixture.NewDbContext())
        {
            var repo = new AccountRepository(ctx);
            await repo.AddAsync(account);
            await ctx.CommitAsync();
            (await repo.ExistsByIdAsync(account.Id)).Should().BeTrue();
            (await repo.ExistsByIdAsync("nonexistent-uid")).Should().BeFalse();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            var repo = new AccountRepository(ctx);
            var loaded = await repo.GetByIdAsync(account.Id);
            loaded.Should().NotBeNull();
            loaded!.Email.Value.Should().Be(email);
            loaded.Nickname.Should().Be("Tester_1");
            loaded.Status.Should().Be(AccountStatus.Active);
            loaded.WalletAddress.Should().BeNull();
            loaded.WalletLinked.Should().BeFalse();
            loaded.CreatedAt.Should().NotBe(default);

            loaded.LinkWallet(wallet);
            repo.Update(loaded);
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            var repo = new AccountRepository(ctx);
            var loaded = await repo.GetByIdAsync(account.Id);
            loaded!.Status.Should().Be(AccountStatus.Active);
            loaded.WalletAddress.Should().Be(wallet);
            loaded.WalletLinkedAt.Should().NotBeNull();
            loaded.WalletLinked.Should().BeTrue();
            loaded.UpdatedAt.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task AccountRepository_ShouldEnforceUniqueWalletAddress()
    {
        var wallet = NewWallet();

        var first = MakeAccount();
        first.LinkWallet(wallet);
        await using (var ctx = fixture.NewDbContext())
        {
            await new AccountRepository(ctx).AddAsync(first);
            await ctx.CommitAsync();
        }

        var second = MakeAccount();
        second.LinkWallet(wallet);
        await using var ctx2 = fixture.NewDbContext();
        await new AccountRepository(ctx2).AddAsync(second);
        await Assert.ThrowsAsync<ConflictException>(() => ctx2.CommitAsync());
    }

    [Fact]
    public async Task AccountRepository_ShouldAllowMultipleNullWallets()
    {
        var a = MakeAccount();
        var b = MakeAccount();

        await using var ctx = fixture.NewDbContext();
        var repo = new AccountRepository(ctx);
        await repo.AddAsync(a);
        await repo.AddAsync(b);
        await ctx.CommitAsync();

        (await repo.GetByIdAsync(a.Id)).Should().NotBeNull();
        (await repo.GetByIdAsync(b.Id)).Should().NotBeNull();
    }

    [Fact]
    public async Task AccountRepository_GetByIdNoTrackingAsync_ShouldReturnAccount_NotTracked()
    {
        var account = MakeAccount();
        await using (var ctx = fixture.NewDbContext())
        {
            await new AccountRepository(ctx).AddAsync(account);
            await ctx.CommitAsync();
        }

        await using var verify = fixture.NewDbContext();
        var repo = new AccountRepository(verify);
        var loaded = await repo.GetByIdNoTrackingAsync(account.Id);
        loaded.Should().NotBeNull();
        loaded!.Email.Value.Should().Be(account.Email.Value);
        verify.ChangeTracker.Entries<Account>().Should().BeEmpty();
    }

    [Fact]
    public async Task AccountRepository_GetByIdNoTrackingAsync_ShouldReturnNull_WhenNotFound()
    {
        await using var ctx = fixture.NewDbContext();
        var result = await new AccountRepository(ctx).GetByIdNoTrackingAsync("nonexistent-uid");
        result.Should().BeNull();
    }

    [Fact]
    public async Task AuditingInterceptor_ShouldSetCreatedAt_ViaSynchronousSaveChanges()
    {
        var account = MakeAccount();
        await using var ctx = fixture.NewDbContext();
        await ctx.Set<Account>().AddAsync(account);
        ctx.SaveChanges();

        await using var verify = fixture.NewDbContext();
        var loaded = await verify.Set<Account>().FindAsync(account.Id);
        loaded!.CreatedAt.Should().NotBe(default, "sync SaveChanges must also apply auditing timestamps");
    }

    // ───────────────────────── WalletLinkNonceRepository ─────────────────────────

    private static WalletLinkNonce MakeNonce(string accountId, string? nonce = null) =>
        WalletLinkNonce.Issue(
            accountId,
            nonce ?? Guid.NewGuid().ToString("N"),
            "Link this wallet to your BitChicken account",
            DateTimeOffset.UtcNow.AddMinutes(5));

    [Fact]
    public async Task WalletLinkNonceRepository_ShouldRoundTrip_AndExposeFields()
    {
        var account = MakeAccount();
        await using (var ctx = fixture.NewDbContext())
        {
            await new AccountRepository(ctx).AddAsync(account);
            await ctx.CommitAsync();
        }

        var nonce = MakeNonce(account.Id);
        await using (var ctx = fixture.NewDbContext())
        {
            await new WalletLinkNonceRepository(ctx).AddAsync(nonce);
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            var repo = new WalletLinkNonceRepository(ctx);
            var loaded = await repo.GetByAccountIdAsync(account.Id);
            loaded.Should().NotBeNull();
            loaded!.AccountId.Should().Be(account.Id);
            loaded.Nonce.Should().Be(nonce.Nonce);
            loaded.Message.Should().Be(nonce.Message);
            loaded.ExpiresAt.Should().BeCloseTo(nonce.ExpiresAt, TimeSpan.FromSeconds(1));
            loaded.CreatedAt.Should().NotBe(default);

            (await repo.GetByAccountIdAsync("unknown-account")).Should().BeNull();
        }
    }

    [Fact]
    public async Task WalletLinkNonceRepository_ShouldUpsert_ReplacingPriorNonce()
    {
        var account = MakeAccount();
        await using (var ctx = fixture.NewDbContext())
        {
            await new AccountRepository(ctx).AddAsync(account);
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            await new WalletLinkNonceRepository(ctx).AddAsync(MakeNonce(account.Id, "first-nonce"));
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            var repo = new WalletLinkNonceRepository(ctx);
            var existing = await repo.GetByAccountIdAsync(account.Id);
            existing!.Refresh("second-nonce", "second-message", DateTimeOffset.UtcNow.AddMinutes(5));
            repo.Update(existing);
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            var loaded = await new WalletLinkNonceRepository(ctx).GetByAccountIdAsync(account.Id);
            loaded!.Nonce.Should().Be("second-nonce");
            loaded.Message.Should().Be("second-message");
            loaded.UpdatedAt.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task WalletLinkNonceRepository_ShouldRemove_OnConsume()
    {
        var account = MakeAccount();
        await using (var ctx = fixture.NewDbContext())
        {
            await new AccountRepository(ctx).AddAsync(account);
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            await new WalletLinkNonceRepository(ctx).AddAsync(MakeNonce(account.Id));
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            var repo = new WalletLinkNonceRepository(ctx);
            var existing = await repo.GetByAccountIdAsync(account.Id);
            repo.Remove(existing!);
            await ctx.CommitAsync();
        }

        await using (var ctx = fixture.NewDbContext())
        {
            (await new WalletLinkNonceRepository(ctx).GetByAccountIdAsync(account.Id)).Should().BeNull();
        }
    }
}
