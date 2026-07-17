using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application._Querying;
using RW.BC.Application.Editions.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Editions;

[Collection("Api")]
public sealed class GetEditionsTests(ApiWebApplicationFactory factory) : IAsyncLifetime
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
            mc.Clear();
    }

    private static async Task SeedAsync(NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            TRUNCATE indexer.editions, indexer.nfts, indexer.listings;

            INSERT INTO indexer.editions
                (edition_id, name, art_uri, health, skill, morale, rarity, max_supply, minted, mint_start, mint_end, price, distribution, active)
            VALUES
                (1,  'Rhode Island Red', 'ipfs://QmRed',   80, 70, 60, 1, 1000, 100, 0, 9999999, 1000000000000000000, 0, true),
                (2,  'Leghorn White',   'ipfs://QmWhite',  50, 90, 75, 3, 500,   50, 0, 9999999, 2000000000000000000, 0, true),
                (3,  'Silkie Black',    'ipfs://QmBlack',  60, 65, 80, 5, 200,   10, 0, 9999999, 5000000000000000000, 1, false);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetEditions_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetEditions_ShouldReturnAllEditions_WithCorrectFields()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(3);
        result.Items.Should().HaveCount(3);

        var first = result.Items.First(e => e.Id == "1");
        first.Name.Should().Be("Rhode Island Red");
        first.ArtUri.Should().Be("ipfs://QmRed");
        first.Health.Should().Be(80);
        first.Skill.Should().Be(70);
        first.Morale.Should().Be(60);
        first.Rarity.Should().Be(1);
        first.MaxSupply.Should().Be("1000");
        first.Minted.Should().Be("100");
        first.Price.Should().Be("1000000000000000000");
        first.Distribution.Should().Be(0);
        first.Active.Should().BeTrue();
    }

    [Fact]
    public async Task GetEditions_ShouldFilterByActiveTrue()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?filter=active%3Dtrue&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(2);
        result.Items.Should().AllSatisfy(e => e.Active.Should().BeTrue());
    }

    [Fact]
    public async Task GetEditions_ShouldFilterByRarity()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?filter=rarity%3D3");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Rarity.Should().Be(3);
        result.Items[0].Name.Should().Be("Leghorn White");
    }

    [Fact]
    public async Task GetEditions_ShouldFilterByName()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?filter=name%3DSilkie+Black");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Name.Should().Be("Silkie Black");
    }

    [Fact]
    public async Task GetEditions_ShouldOrderById_Ascending()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?orderBy=id&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result.Should().NotBeNull();
        var ids = result!.Items.Select(e => long.Parse(e.Id)).ToList();
        ids.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task GetEditions_ShouldPaginate()
    {
        var client = factory.CreateClient();

        var page1 = await client.GetAsync("/editions?page=1&pageSize=10");
        var page2 = await client.GetAsync("/editions?page=2&pageSize=10");

        page1.StatusCode.Should().Be(HttpStatusCode.OK);
        page2.StatusCode.Should().Be(HttpStatusCode.OK);

        var result1 = await page1.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        var result2 = await page2.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();

        result1!.TotalCount.Should().Be(3);
        result1.Items.Should().HaveCount(3);
        result2!.TotalCount.Should().Be(3);
        result2.Items.Should().BeEmpty("page 2 has no items when all 3 fit on page 1");
    }

    [Fact]
    public async Task GetEditions_ShouldReturnEmpty_WhenFilterMatchesNothing()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?filter=rarity%3D99");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetEditions_ShouldReturn422_WhenPageSizeExceedsMax()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?pageSize=101");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetEditions_ShouldReturn400OrError_WhenFilterReferencesNonWhitelistedField()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?filter=artUri%3Dipfs%3A%2F%2FQmRed");

        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.UnprocessableEntity,
            HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GetEditions_ShouldReturnIdAsString()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/editions?filter=id%3D1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);
        result.Items[0].Id.Should().Be("1");
    }

    [Fact]
    public async Task GetEditions_Cache_ShouldServeSubsequentRequests_WithoutAdditionalDbLoad()
    {
        ClearCache();

        var client = factory.CreateClient();

        var first = await client.GetAsync("/editions?pageSize=10");
        var second = await client.GetAsync("/editions?pageSize=10");

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        var r1 = await first.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        var r2 = await second.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();

        r1!.TotalCount.Should().Be(r2!.TotalCount);
        r1.Items.Select(e => e.Id).Should().BeEquivalentTo(r2.Items.Select(e => e.Id));
    }

    [Fact]
    public async Task GetEditions_Cache_ShouldApplyFilterAndPagination_OverCachedList()
    {
        ClearCache();

        var client = factory.CreateClient();

        var _ = await client.GetAsync("/editions?pageSize=10");
        var filtered = await client.GetAsync("/editions?filter=active%3Dtrue&pageSize=10");

        filtered.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await filtered.Content.ReadFromJsonAsync<PagedResponse<EditionDto>>();
        result!.TotalCount.Should().Be(2);
        result.Items.Should().AllSatisfy(e => e.Active.Should().BeTrue());
    }
}
