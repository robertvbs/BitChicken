using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using RW.BC.Application.Abstractions;
using RW.BC.Domain.Accounts;
using RW.BC.Domain.BuildingBlocks;

namespace RW.BC.Infrastructure.Persistence.IntegrationTests;

public sealed class DbContextSaveChangesExtensionsTests
{
    private static string NewUid() => "uid-save-ext-" + Guid.NewGuid().ToString("N")[..8];
    private static string NewEmail() => $"save-ext-{Guid.NewGuid():N}@example.com";

    private static Account MakeAccount() =>
        Account.Create(NewUid(), Email.Create(NewEmail()), "Tester_1");

    [Fact]
    public async Task SaveChangesMappingExceptions_ShouldThrowInfrastructureException_OnGenericDbUpdateException()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase("savechanges_generic_" + Guid.NewGuid())
            .AddInterceptors(new GenericFaultInterceptor())
            .Options;

        await using var ctx = new DataContext(options);
        await ctx.Set<Account>().AddAsync(MakeAccount());

        await Assert.ThrowsAsync<InfrastructureException>(
            () => ctx.SaveChangesMappingExceptionsAsync(CancellationToken.None));
    }

    [Fact]
    public async Task SaveChangesMappingExceptions_ShouldThrowDomainException_OnDbUpdateConcurrencyException()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase("savechanges_concurrency_" + Guid.NewGuid())
            .AddInterceptors(new ConcurrencyFaultInterceptor())
            .Options;

        await using var ctx = new DataContext(options);
        await ctx.Set<Account>().AddAsync(MakeAccount());

        await Assert.ThrowsAsync<DomainException>(
            () => ctx.SaveChangesMappingExceptionsAsync(CancellationToken.None));
    }

    [Fact]
    public async Task SaveChangesMappingExceptions_ShouldThrowArgumentNullException_WhenContextIsNull()
    {
        DbContext? ctx = null;
        await Assert.ThrowsAsync<ArgumentNullException>(
            () => ctx!.SaveChangesMappingExceptionsAsync(CancellationToken.None));
    }

    private sealed class GenericFaultInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
            => throw new DbUpdateException("simulated generic failure");
    }

    private sealed class ConcurrencyFaultInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
            => throw new DbUpdateConcurrencyException("simulated concurrency failure");
    }
}
