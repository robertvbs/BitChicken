using FluentAssertions;
using Npgsql;
using RW.BC.Api.Realtime;
using Testcontainers.PostgreSql;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Realtime;

public sealed class ListingsChangeDetectorDbTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17.6")
        .WithDatabase("detector_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private NpgsqlConnection _connection = null!;
    private readonly ListingsChangeDetector _sut = new();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        _connection = new NpgsqlConnection(_container.GetConnectionString());
        await _connection.OpenAsync();
    }

    public async Task DisposeAsync()
    {
        await _connection.DisposeAsync();
        await _container.DisposeAsync();
    }

    [Fact]
    public async Task TryReadSnapshot_ShouldReturnNull_WhenTableDoesNotExist()
    {
        var result = await _sut.TryReadSnapshotAsync(_connection, CancellationToken.None);

        result.Should().BeNull("indexer.listings does not exist yet");
    }

    [Fact]
    public async Task TryReadSnapshot_ShouldReturnZeroSnapshot_WhenTableIsEmpty()
    {
        await CreateListingsTableAsync();

        var result = await _sut.TryReadSnapshotAsync(_connection, CancellationToken.None);

        result.Should().NotBeNull();
        result!.Value.Count.Should().Be(0);
        result.Value.MaxBlock.Should().Be(0L);
    }

    [Fact]
    public async Task TryReadSnapshot_ShouldReturnCorrectSnapshot_WhenRowsExist()
    {
        await CreateListingsTableAsync();
        await SeedListingsAsync();

        var result = await _sut.TryReadSnapshotAsync(_connection, CancellationToken.None);

        result.Should().NotBeNull();
        result!.Value.Count.Should().Be(2);
        result.Value.MaxBlock.Should().Be(210L);
    }

    [Fact]
    public async Task TryReadSnapshot_ShouldDetectChange_AfterInsert()
    {
        await CreateListingsTableAsync();

        var before = await _sut.TryReadSnapshotAsync(_connection, CancellationToken.None);
        before.Should().NotBeNull("empty table returns a zero snapshot, not null");
        _sut.HasChanged(before, before).Should().BeFalse("same snapshot is not a change");

        await SeedListingsAsync();

        var after = await _sut.TryReadSnapshotAsync(_connection, CancellationToken.None);
        _sut.HasChanged(before, after).Should().BeTrue("count changed from 0 to 2");
    }

    private async Task CreateListingsTableAsync()
    {
        await using var cmd = _connection.CreateCommand();
        cmd.CommandText = """
            CREATE SCHEMA IF NOT EXISTS indexer;
            CREATE TABLE IF NOT EXISTS indexer.listings (
                token_id         numeric(78,0) NOT NULL PRIMARY KEY,
                seller           text          NOT NULL,
                price            numeric(78,0) NOT NULL,
                status           text          NOT NULL,
                edition_id       numeric(78,0) NULL,
                listed_at_block  numeric(78,0) NOT NULL,
                updated_at_block numeric(78,0) NOT NULL,
                tx_hash          text          NOT NULL
            );
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedListingsAsync()
    {
        await using var cmd = _connection.CreateCommand();
        cmd.CommandText = """
            INSERT INTO indexer.listings (token_id, seller, price, status, listed_at_block, updated_at_block, tx_hash)
            VALUES
                (1, '0xseller1', 1000000000000000000, 'Active', 100, 110, '0xaaa'),
                (2, '0xseller2', 2000000000000000000, 'Active', 200, 210, '0xbbb');
            """;
        await cmd.ExecuteNonQueryAsync();
    }
}
