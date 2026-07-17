using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application._Querying;
using RW.BC.Application.Forge.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Forge;

[Collection("Api")]
public sealed class GetAccountForgeRequestsTests(ApiWebApplicationFactory factory) : IAsyncLifetime
{
    private static readonly string IndexerViewsSql = File.ReadAllText(
        Path.Combine(AppContext.BaseDirectory, "_Fixtures", "indexer-views.sql"));

    private const string BuyerA = "0xaaaa000000000000000000000000000000000001";
    private const string BuyerB = "0xbbbb000000000000000000000000000000000002";

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
            TRUNCATE indexer.forge_requests;

            INSERT INTO indexer.forge_requests
                (request_id, buyer, tier, status, token_id, edition_id, block_number, fulfilled_at_block)
            VALUES
                (1, '{BuyerA}', 1, 'Requested',  NULL, NULL, 100, NULL),
                (2, '{BuyerA}', 2, 'Fulfilled',  42,   10,   200, 250),
                (3, '{BuyerA}', 1, 'Cancelled',  NULL, NULL, 300, NULL),
                (4, '{BuyerB}', 3, 'Fulfilled',  99,   20,   400, 420);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldFilterByBuyer()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(3, "buyer A has 3 requests");
        result.Items.Should().HaveCount(3);
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldNormalizeAddressToLowercase()
    {
        var client = factory.CreateClient();
        var mixedCase = "0xAAAA000000000000000000000000000000000001";

        var response = await client.GetAsync($"/accounts/{mixedCase}/forge-requests");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(3, "address normalization to lowercase matches the seeded buyer");
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldReturnEmpty_WhenBuyerHasNoRequests()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/accounts/0xdeadbeef000000000000000000000000cafebabe/forge-requests");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldFilterByStatus()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests?filter=status%3DFulfilled");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Status.Should().Be("Fulfilled");
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldFilterByTier()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests?filter=tier%3D1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(2, "buyer A has 2 tier-1 requests");
        result.Items.Should().AllSatisfy(r => r.Tier.Should().Be(1));
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldOrderByRequestIdDesc_ByDefault()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        var ids = result!.Items.Select(r => long.Parse(r.RequestId)).ToList();
        ids.Should().BeInDescendingOrder("default orderBy is requestId desc");
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldReturnFulfilledFields_ForFulfilledRequest()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests?filter=status%3DFulfilled");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        var item = result!.Items[0];
        item.RequestId.Should().Be("2");
        item.Tier.Should().Be(2);
        item.TokenId.Should().Be("42");
        item.EditionId.Should().Be("10");
        item.BlockNumber.Should().Be("200");
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldReturnNullTokenAndEdition_ForRequestedStatus()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests?filter=status%3DRequested");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);
        var item = result.Items[0];
        item.TokenId.Should().BeNull();
        item.EditionId.Should().BeNull();
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldPaginate()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests?page=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<ForgeRequestDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(3);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
    }

    [Fact]
    public async Task GetAccountForgeRequests_ShouldReturn422_WhenPageSizeExceedsMax()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerA}/forge-requests?pageSize=101");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
