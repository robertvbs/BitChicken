using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application._Querying;
using RW.BC.Application.Nfts.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Nfts;

[Collection("Api")]
public sealed class GetAccountNftsTests(ApiWebApplicationFactory factory) : IAsyncLifetime
{
    private static readonly string IndexerViewsSql = File.ReadAllText(
        Path.Combine(AppContext.BaseDirectory, "_Fixtures", "indexer-views.sql"));

    private const string OwnerA = "0xaaaa000000000000000000000000000000000001";
    private const string OwnerB = "0xbbbb000000000000000000000000000000000002";

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
        cmd.CommandText = $"""
            TRUNCATE indexer.editions, indexer.nfts, indexer.listings;

            INSERT INTO indexer.editions
                (edition_id, name, art_uri, health, skill, morale, rarity, max_supply, minted, mint_start, mint_end, price, distribution, active)
            VALUES
                (10, 'Rhode Island Red', 'ipfs://QmRed',  80, 70, 60, 1, 1000, 100, 0, 9999999, 1000000000000000000, 0, true),
                (20, 'Leghorn White',   'ipfs://QmWhite', 50, 90, 75, 3, 500,   50, 0, 9999999, 2000000000000000000, 0, true);

            INSERT INTO indexer.nfts
                (token_id, owner, edition_id, gender, nft_name, staked, burned)
            VALUES
                (1,  '{OwnerA}', 10, 0, 'Clucky',    false, false),
                (2,  '{OwnerA}', 20, 1, 'Henrietta', true,  false),
                (3,  '{OwnerA}', 10, 0, 'BurnedOne', false, true),
                (4,  '{OwnerB}', 10, 0, 'Snowball',  false, false),
                (5,  '{OwnerB}', 20, 1, 'Bianca',    true,  false);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetAccountNfts_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetAccountNfts_ShouldReturnOnlyOwnerNfts()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts?pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(2, "token 3 is burned and excluded; token 4 and 5 belong to OwnerB");
        result.Items.Should().HaveCount(2);
        result.Items.Should().AllSatisfy(n => n.TokenId.Should().BeOneOf("1", "2"));
    }

    [Fact]
    public async Task GetAccountNfts_ShouldExcludeBurnedNfts()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts?pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().NotContain(n => n.TokenId == "3");
    }

    [Fact]
    public async Task GetAccountNfts_ShouldReturnEnrichedFields()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts?filter=tokenId%3D1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);

        var item = result.Items[0];
        item.TokenId.Should().Be("1");
        item.EditionId.Should().Be("10");
        item.EditionName.Should().Be("Rhode Island Red");
        item.ArtUri.Should().Be("ipfs://QmRed");
        item.Rarity.Should().Be(1);
        item.NftName.Should().Be("Clucky");
        item.Staked.Should().BeFalse();
        item.Attributes.Should().NotBeNull();
        item.Attributes.Health.Should().Be(80);
        item.Attributes.Skill.Should().Be(70);
        item.Attributes.Morale.Should().Be(60);
        item.Attributes.Gender.Should().Be(0);
    }

    [Fact]
    public async Task GetAccountNfts_ShouldFilterByStaked()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts?filter=staked%3Dtrue");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Staked.Should().BeTrue();
        result.Items[0].NftName.Should().Be("Henrietta");
    }

    [Fact]
    public async Task GetAccountNfts_ShouldFilterByRarity()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerB}/nfts?filter=rarity%3D3&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Rarity.Should().Be(3);
        result.Items[0].NftName.Should().Be("Bianca");
    }

    [Fact]
    public async Task GetAccountNfts_ShouldFilterByEditionId()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerB}/nfts?filter=editionId%3D20");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].EditionId.Should().Be("20");
    }

    [Fact]
    public async Task GetAccountNfts_ShouldOrderByTokenId_Ascending()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts?orderBy=tokenId&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        var ids = result!.Items.Select(n => long.Parse(n.TokenId)).ToList();
        ids.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task GetAccountNfts_ShouldReturnEmpty_WhenOwnerHasNoNfts()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/accounts/0xdeadbeef000000000000000000000000cafebabe/nfts");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAccountNfts_ShouldBeCaseInsensitive_OnAddress()
    {
        var client = factory.CreateClient();

        var mixedCase = "0xAAAA000000000000000000000000000000000001";
        var response = await client.GetAsync($"/accounts/{mixedCase}/nfts?pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(2, "address is normalized to lowercase before querying");
    }

    [Fact]
    public async Task GetAccountNfts_ShouldReturn422_WhenPageSizeExceedsMax()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts?pageSize=101");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetAccountNfts_ShouldReturn400OrError_WhenFilterReferencesNonWhitelistedField()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{OwnerA}/nfts?filter=burned%3Dtrue");

        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.UnprocessableEntity,
            HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GetAccountNfts_ShouldPaginate()
    {
        var client = factory.CreateClient();

        var page1 = await client.GetAsync($"/accounts/{OwnerB}/nfts?page=1&pageSize=10");
        var page2 = await client.GetAsync($"/accounts/{OwnerB}/nfts?page=2&pageSize=10");

        page1.StatusCode.Should().Be(HttpStatusCode.OK);
        page2.StatusCode.Should().Be(HttpStatusCode.OK);

        var r1 = await page1.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();
        var r2 = await page2.Content.ReadFromJsonAsync<PagedResponse<NftItemDto>>();

        r1!.TotalCount.Should().Be(2);
        r1.Items.Should().HaveCount(2);
        r2!.TotalCount.Should().Be(2);
        r2.Items.Should().BeEmpty("page 2 has no items when both nfts fit on page 1");
    }
}
