using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application._Querying;
using RW.BC.Application.Marketplace.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Marketplace;

[Collection("Api")]
public sealed class GetListingsTests(ApiWebApplicationFactory factory) : IAsyncLifetime
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
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task SeedAsync(NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            TRUNCATE indexer.editions, indexer.nfts, indexer.listings;

            INSERT INTO indexer.editions
                (edition_id, name, art_uri, health, skill, morale, rarity, max_supply, minted, mint_start, mint_end, price, distribution, active)
            VALUES
                (10, 'Rhode Island Red', 'ipfs://QmRed',   80, 70, 60, 1, 1000, 100, 0, 9999999, 1000000000000000000, 0, true),
                (20, 'Leghorn White',   'ipfs://QmWhite',  50, 90, 75, 3, 500,   50, 0, 9999999, 2000000000000000000, 0, true);

            INSERT INTO indexer.nfts
                (token_id, owner, edition_id, gender, nft_name, staked, burned)
            VALUES
                (1, '0xowner0000000000000000000000000000000001', 10, 0, 'Clucky',    false, false),
                (2, '0xowner0000000000000000000000000000000002', 10, 1, 'Henrietta', false, false),
                (3, '0xowner0000000000000000000000000000000003', 20, 0, 'Snowball',  false, false);

            INSERT INTO indexer.listings
                (token_id, seller, price, status, edition_id, listed_at_block, updated_at_block, tx_hash)
            VALUES
                (1, '0xseller000000000000000000000000000000001', 1000000000000000000, 'Active',    10,  100, 110, '0x' || repeat('a', 64)),
                (2, '0xseller000000000000000000000000000000002', 2000000000000000000, 'Active',    10,  200, 210, '0x' || repeat('b', 64)),
                (3, '0xseller000000000000000000000000000000003',  500000000000000000, 'Active',    20,  300, 320, '0x' || repeat('c', 64)),
                (4, '0xseller000000000000000000000000000000004', 3000000000000000000, 'Active',    NULL,400, 410, '0x' || repeat('d', 64)),
                (5, '0xseller000000000000000000000000000000005',  100000000000000000, 'Cancelled', 10,  500, 510, '0x' || repeat('e', 64)),
                (6, '0xseller000000000000000000000000000000006',  200000000000000000, 'Sold',      10,  600, 610, '0x' || repeat('f', 64));
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetListings_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetListings_ShouldIncludeListingsLackingNftOrEdition_WithNullEnrichment()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(4,
            "LEFT JOINs include token_id=4 (Active but no nft row) with empty enrichment fields; Sold (token_id=6) and Cancelled (token_id=5) are excluded by server-side status filter");
        result.Items.Should().HaveCount(4);
    }

    [Fact]
    public async Task GetListings_ShouldReturnEnrichedFields_ForJoinedListing()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=tokenId%3D1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);

        var item = result.Items[0];
        item.TokenId.Should().Be("1");
        item.Seller.Should().Be("0xseller000000000000000000000000000000001");
        item.Price.Should().Be("1000000000000000000");
        item.Status.Should().Be("Active");
        item.EditionId.Should().Be("10");
        item.EditionName.Should().Be("Rhode Island Red");
        item.ArtUri.Should().Be("ipfs://QmRed");
        item.Rarity.Should().Be(1);
        item.Gender.Should().Be(0);
        item.NftName.Should().Be("Clucky");
        item.Attributes.Should().NotBeNull();
        item.Attributes.Health.Should().Be(80);
        item.Attributes.Skill.Should().Be(70);
        item.Attributes.Morale.Should().Be(60);
    }

    [Fact]
    public async Task GetListings_ShouldFilterByStatusActive()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=status%3DActive");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(4);
        result.Items.Should().AllSatisfy(l => l.Status.Should().Be("Active"));
    }

    [Fact]
    public async Task GetListings_ShouldFilterByEditionName()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=editionName%3DLeghorn+White");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].EditionName.Should().Be("Leghorn White");
    }

    [Fact]
    public async Task GetListings_ShouldFilterByRarity()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=rarity%3D3");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Rarity.Should().Be(3);
    }

    [Fact]
    public async Task GetListings_ShouldFilterByGender()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=gender%3D1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Gender.Should().Be(1);
        result.Items[0].NftName.Should().Be("Henrietta");
    }

    [Fact]
    public async Task GetListings_ShouldOrderByPrice_Ascending()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?orderBy=price");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        var prices = result!.Items.Select(l => decimal.Parse(l.Price)).ToList();
        prices.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task GetListings_ShouldPaginate()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?page=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(4);
        result.Items.Should().HaveCount(4);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(9)]
    public async Task GetListings_ShouldReturn200_WhenPageSizeIsBelowFormerMinimum(int pageSize)
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/marketplace/listings?pageSize={pageSize}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetListings_ShouldReturn422_WhenPageSizeExceedsMax()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?pageSize=101");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetListings_ShouldReturn422_WithSingleValidationMessage_WhenPageSizeIsInvalid()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?pageSize=0");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var body = await response.Content.ReadAsStringAsync();
        var occurrences = System.Text.RegularExpressions.Regex.Matches(
            body, "Page Size must be between").Count;
        occurrences.Should().Be(1, "validation message must not be duplicated by double-registered validators");
    }

    [Fact]
    public async Task GetListings_ShouldReturn400OrError_WhenFilterReferencesNonWhitelistedField()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=artUri%3Dipfs%3A%2F%2FQmRed");

        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.UnprocessableEntity,
            HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GetListings_ShouldReturnFilteredByListedAtBlock()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=listedAtBlock%3D100");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1, "only token_id=1 has listed_at_block=100");
    }

    [Fact]
    public async Task GetListings_ShouldReturnEmpty_WhenFilterMatchesNothing()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?filter=status%3DPending");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetListings_ShouldReturnTokenIdAsString()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings?orderBy=tokenId");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ListingDto>>();
        result.Should().NotBeNull();
        result!.Items.First().TokenId.Should().Be("1");
    }

    [Fact]
    public async Task GetListings_ShouldNotExposeOwnerField_InResponse()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/marketplace/listings");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync();
        json.Should().NotContain("\"owner\"");
    }
}
