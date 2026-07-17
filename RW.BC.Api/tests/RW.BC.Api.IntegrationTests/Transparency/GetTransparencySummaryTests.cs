using System.Net;
using System.Net.Http.Json;
using System.Numerics;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application.Transparency.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Transparency;

[Collection("Api")]
public sealed class GetTransparencySummaryTests(ApiWebApplicationFactory factory) : IAsyncLifetime
{
    private static readonly string IndexerViewsSql = File.ReadAllText(
        Path.Combine(AppContext.BaseDirectory, "_Fixtures", "indexer-views.sql"));

    public async Task InitializeAsync()
    {
        await using var conn = new NpgsqlConnection(factory.ConnectionString);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = IndexerViewsSql;
        await cmd.ExecuteNonQueryAsync();

        await SeedAsync(conn);
        ClearCache();
    }

    public Task DisposeAsync()
    {
        ClearCache();
        return Task.CompletedTask;
    }

    private void ClearCache()
    {
        var cache = factory.Services.GetRequiredService<IMemoryCache>();
        if (cache is MemoryCache mc)
            mc.Compact(1.0);
    }

    private static async Task SeedAsync(NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            TRUNCATE indexer.sales, indexer.nfts, indexer.editions, indexer.token_transfers;

            INSERT INTO indexer.editions (edition_id, name, art_uri, health, skill, morale, rarity, max_supply, minted, mint_start, mint_end, price, distribution, active)
            VALUES
                (1, 'Edition A', 'ipfs://A', 80, 70, 60, 1, 1000, 100, 0, 9999999, 1000000000000000000, 0, true),
                (2, 'Edition B', 'ipfs://B', 50, 90, 75, 3, 500,   50, 0, 9999999, 2000000000000000000, 0, true);

            INSERT INTO indexer.nfts (token_id, owner, edition_id, gender, nft_name, staked, burned)
            VALUES
                (1, '0xowner0001', 1, 0, 'Alpha', false, false),
                (2, '0xowner0002', 1, 1, 'Beta',  false, false),
                (3, '0xowner0003', 2, 0, 'Gamma', false, true);

            INSERT INTO indexer.sales (id, token_id, seller, buyer, price, platform_fee, royalty, block_number)
            VALUES
                ('s1', 1, '0xseller0001', '0xbuyer0001', 1000000000000000000, 25000000000000000, 10000000000000000, 100),
                ('s2', 2, '0xseller0002', '0xbuyer0002', 2000000000000000000, 50000000000000000, 20000000000000000, 200);

            INSERT INTO indexer.token_transfers (id, from_addr, to_addr, value, block_number)
            VALUES
                ('t1', '0xfrom0001', '0xto0001', 500000000000000000000, 10),
                ('t2', '0xfrom0002', '0xto0002', 300000000000000000000, 20);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetSummary_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetSummary_ShouldReturnCorrectCounts()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransparencySummaryDto>();
        result.Should().NotBeNull();
        result!.SalesCount.Should().Be(2);
        result.NftCount.Should().Be(2, "one NFT is burned and excluded");
        result.EditionCount.Should().Be(2);
    }

    [Fact]
    public async Task GetSummary_ShouldReturnTotalVolumeAsString()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransparencySummaryDto>();
        result.Should().NotBeNull();
        var expectedVolume = new BigInteger(1000000000000000000) + new BigInteger(2000000000000000000);
        result!.TotalVolume.Should().Be(expectedVolume.ToString());
    }

    [Fact]
    public async Task GetSummary_ShouldReturnTotalBcknTransferredAsString()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransparencySummaryDto>();
        result.Should().NotBeNull();
        var expected = BigInteger.Parse("500000000000000000000") + BigInteger.Parse("300000000000000000000");
        result!.TotalBcknTransferred.Should().Be(expected.ToString());
    }

    [Fact]
    public async Task GetSummary_ShouldNotOverflow_WhenValueApproachesUint256Max()
    {
        await using var conn = new NpgsqlConnection(factory.ConnectionString);
        await conn.OpenAsync();

        await using var truncCmd = conn.CreateCommand();
        truncCmd.CommandText = "TRUNCATE indexer.token_transfers";
        await truncCmd.ExecuteNonQueryAsync();

        var nearMaxUint256 = BigInteger.Pow(2, 255);
        await using var insertCmd = conn.CreateCommand();
        insertCmd.CommandText = $"""
            INSERT INTO indexer.token_transfers (id, from_addr, to_addr, value, block_number)
            VALUES ('t-big', '0xfrom', '0xto', {nearMaxUint256}, 999)
            """;
        await insertCmd.ExecuteNonQueryAsync();

        ClearCache();

        var client = factory.CreateClient();
        var response = await client.GetAsync("/transparency/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransparencySummaryDto>();
        result.Should().NotBeNull();
        result!.TotalBcknTransferred.Should().Be(nearMaxUint256.ToString(),
            "SQL SUM::text must survive values far beyond decimal range");
    }

    [Fact]
    public async Task GetSummary_ShouldReturnZeroSums_WhenTablesAreEmpty()
    {
        await using var conn = new NpgsqlConnection(factory.ConnectionString);
        await conn.OpenAsync();

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "TRUNCATE indexer.sales, indexer.nfts, indexer.editions, indexer.token_transfers";
        await cmd.ExecuteNonQueryAsync();

        ClearCache();

        var client = factory.CreateClient();
        var response = await client.GetAsync("/transparency/summary");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<TransparencySummaryDto>();
        result.Should().NotBeNull();
        result!.SalesCount.Should().Be(0);
        result.TotalVolume.Should().Be("0");
        result.NftCount.Should().Be(0);
        result.EditionCount.Should().Be(0);
        result.TotalBcknTransferred.Should().Be("0");
    }

    [Fact]
    public async Task GetSummary_ShouldServeFromCache_OnSecondCall()
    {
        ClearCache();

        var client = factory.CreateClient();
        var r1 = await (await client.GetAsync("/transparency/summary"))
            .Content.ReadFromJsonAsync<TransparencySummaryDto>();

        await using var conn = new NpgsqlConnection(factory.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            INSERT INTO indexer.sales (id, token_id, seller, buyer, price, platform_fee, royalty, block_number)
            VALUES ('s-cache-test', 99, '0xseller', '0xbuyer', 1, 0, 0, 999)
            """;
        await cmd.ExecuteNonQueryAsync();

        var r2 = await (await client.GetAsync("/transparency/summary"))
            .Content.ReadFromJsonAsync<TransparencySummaryDto>();

        r2!.SalesCount.Should().Be(r1!.SalesCount,
            "cache TTL has not expired so the new row must not be visible yet");
    }
}
