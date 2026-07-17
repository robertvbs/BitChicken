using FluentAssertions;
using Npgsql;
using RW.BC.Api.Realtime;
using Testcontainers.PostgreSql;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Realtime;

public sealed class ForgeFulfillmentDetectorDbTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:17.6")
        .WithDatabase("forge_detector_test")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private NpgsqlConnection _connection = null!;

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
    public async Task GetNewFulfillments_ShouldReturnEmpty_WhenTableDoesNotExist()
    {
        var sut = new ForgeFulfillmentDetector();

        var result = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        result.Should().BeEmpty("table absent is treated as indexer not bootstrapped");
    }

    [Fact]
    public async Task GetNewFulfillments_ShouldReturnEmpty_WhenTableIsEmpty()
    {
        await CreateForgeRequestsTableAsync();
        var sut = new ForgeFulfillmentDetector();

        var result = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetNewFulfillments_ShouldReturnEmpty_WhenNoFulfilledRowsExist()
    {
        await CreateForgeRequestsTableAsync();
        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (1, '0xbuyer', 1, 'Requested', NULL, NULL, 100, NULL);
            """);
        var sut = new ForgeFulfillmentDetector();

        var result = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        result.Should().BeEmpty("only Requested rows, no Fulfilled");
    }

    [Fact]
    public async Task GetNewFulfillments_ShouldDetectFulfilledRows()
    {
        await CreateForgeRequestsTableAsync();
        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (1, '0xbuyer', 1, 'Fulfilled', 42, 10, 100, 150);
            """);
        var sut = new ForgeFulfillmentDetector();

        var result = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        result.Should().HaveCount(1);
        result[0].RequestId.Should().Be("1");
        result[0].Buyer.Should().Be("0xbuyer");
        result[0].TokenId.Should().Be("42");
        result[0].EditionId.Should().Be("10");
    }

    [Fact]
    public async Task GetNewFulfillments_ShouldAdvanceCursor_AfterDetection()
    {
        await CreateForgeRequestsTableAsync();
        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (1, '0xbuyer', 1, 'Fulfilled', 42, 10, 100, 150);
            """);
        var sut = new ForgeFulfillmentDetector();

        await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        sut.LastFulfilledAtBlock.Should().Be(150L, "cursor should advance to the max fulfilled_at_block seen");
    }

    [Fact]
    public async Task GetNewFulfillments_ShouldNotReEmit_AfterCursorAdvanced()
    {
        await CreateForgeRequestsTableAsync();
        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (1, '0xbuyer', 1, 'Fulfilled', 42, 10, 100, 150);
            """);
        var sut = new ForgeFulfillmentDetector();

        var firstCall = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);
        firstCall.Should().HaveCount(1);

        var secondCall = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        secondCall.Should().BeEmpty("same row should not be re-emitted after cursor advances past it");
    }

    [Fact]
    public async Task GetNewFulfillments_ShouldDetectNewFulfillments_AfterCursorAdvanced()
    {
        await CreateForgeRequestsTableAsync();
        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (1, '0xbuyer', 1, 'Fulfilled', 42, 10, 100, 150);
            """);
        var sut = new ForgeFulfillmentDetector();

        var firstCall = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);
        firstCall.Should().HaveCount(1);

        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (2, '0xbuyer2', 2, 'Fulfilled', 99, 20, 200, 300);
            """);

        var secondCall = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        secondCall.Should().HaveCount(1, "only the new row at block 300 is past the cursor 150");
        secondCall[0].RequestId.Should().Be("2");
        secondCall[0].Buyer.Should().Be("0xbuyer2");
    }

    [Fact]
    public async Task GetNewFulfillments_ShouldHandleNullTokenAndEditionId()
    {
        await CreateForgeRequestsTableAsync();
        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (10, '0xbuyer', 1, 'Fulfilled', NULL, NULL, 100, 200);
            """);
        var sut = new ForgeFulfillmentDetector();

        var result = await sut.GetNewFulfillmentsAsync(_connection, CancellationToken.None);

        result.Should().HaveCount(1);
        result[0].TokenId.Should().BeEmpty("NULL token_id maps to empty string");
        result[0].EditionId.Should().BeEmpty("NULL edition_id maps to empty string");
    }

    [Fact]
    public async Task SeedCursorAsync_ShouldReturnZero_WhenTableDoesNotExist()
    {
        var sut = new ForgeFulfillmentDetector();

        await sut.SeedCursorAsync(_connection, CancellationToken.None);

        sut.LastFulfilledAtBlock.Should().Be(0L, "table-missing error is silently treated as zero");
    }

    [Fact]
    public async Task SeedCursorAsync_ShouldSetCursor_WhenFulfilledRowsExist()
    {
        await CreateForgeRequestsTableAsync();
        await SeedAsync("""
            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (1, '0xbuyer', 1, 'Fulfilled', 42, 10, 100, 250);
            """);
        var sut = new ForgeFulfillmentDetector();

        await sut.SeedCursorAsync(_connection, CancellationToken.None);

        sut.LastFulfilledAtBlock.Should().Be(250L);
    }

    [Fact]
    public async Task SeedCursorAsync_ShouldSetCursorToZero_WhenNoFulfilledRows()
    {
        await CreateForgeRequestsTableAsync();
        var sut = new ForgeFulfillmentDetector();

        await sut.SeedCursorAsync(_connection, CancellationToken.None);

        sut.LastFulfilledAtBlock.Should().Be(0L, "COALESCE(MAX(...), 0) for empty table returns 0");
    }

    private async Task CreateForgeRequestsTableAsync()
    {
        await using var cmd = _connection.CreateCommand();
        cmd.CommandText = """
            CREATE SCHEMA IF NOT EXISTS indexer;
            CREATE TABLE IF NOT EXISTS indexer.forge_requests (
                request_id         numeric(78,0) NOT NULL PRIMARY KEY,
                buyer              text          NOT NULL,
                tier               integer       NOT NULL,
                status             text          NOT NULL,
                token_id           numeric(78,0) NULL,
                edition_id         numeric(78,0) NULL,
                block_number       numeric(78,0) NOT NULL,
                fulfilled_at_block numeric(78,0) NULL
            );
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedAsync(string sql)
    {
        await using var cmd = _connection.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync();
    }
}
