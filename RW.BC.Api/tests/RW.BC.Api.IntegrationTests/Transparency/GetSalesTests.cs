using System.Net;
using System.Net.Http.Json;
using System.Numerics;
using FluentAssertions;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application._Querying;
using RW.BC.Application.Transparency.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Transparency;

[Collection("Api")]
public sealed class GetSalesTests(ApiWebApplicationFactory factory) : IAsyncLifetime
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
            TRUNCATE indexer.sales;

            INSERT INTO indexer.sales (id, token_id, seller, buyer, price, platform_fee, royalty, block_number)
            VALUES
                ('sale-1', 1, '0xseller0000000000000000000000000000000001', '0xbuyer00000000000000000000000000000000001', 1000000000000000000, 25000000000000000, 10000000000000000, 100),
                ('sale-2', 2, '0xseller0000000000000000000000000000000002', '0xbuyer00000000000000000000000000000000002', 2000000000000000000, 50000000000000000, 20000000000000000, 200),
                ('sale-3', 3, '0xseller0000000000000000000000000000000001', '0xbuyer00000000000000000000000000000000003', 500000000000000000,  12500000000000000,  5000000000000000,  50);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetSales_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/sales");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetSales_ShouldReturnAllSales_OrderedByBlockNumberDescending_ByDefault()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/sales");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(3);
        result.Items.Should().HaveCount(3);
        var blocks = result.Items.Select(s => s.BlockNumber).ToList();
        blocks.Should().BeInDescendingOrder("default orderBy is blockNumber desc");
    }

    [Fact]
    public async Task GetSales_ShouldFilterBySeller()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/transparency/sales?filter=seller%3D0xseller0000000000000000000000000000000001");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(2);
        result.Items.Should().AllSatisfy(s =>
            s.Seller.Should().Be("0xseller0000000000000000000000000000000001"));
    }

    [Fact]
    public async Task GetSales_ShouldFilterByBuyer()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/transparency/sales?filter=buyer%3D0xbuyer00000000000000000000000000000000002");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Buyer.Should().Be("0xbuyer00000000000000000000000000000000002");
    }

    [Fact]
    public async Task GetSales_ShouldFilterByTokenId()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/sales?filter=tokenId%3D2");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].TokenId.Should().Be("2");
    }

    [Fact]
    public async Task GetSales_ShouldPaginate()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/sales?page=1&pageSize=10");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(3);
        result.Items.Should().HaveCount(3);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
    }

    [Fact]
    public async Task GetSales_ShouldReturnAmountsAsStrings()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/sales?filter=tokenId%3D1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        var sale = result!.Items[0];
        sale.Price.Should().Be("1000000000000000000");
        sale.PlatformFee.Should().Be("25000000000000000");
        sale.Royalty.Should().Be("10000000000000000");
        sale.TokenId.Should().Be("1");
    }

    [Fact]
    public async Task GetSales_ShouldReturn422_WhenPageSizeExceedsMax()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/sales?pageSize=101");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetSales_ShouldReturn400OrError_WhenFilterReferencesNonWhitelistedField()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/transparency/sales?filter=price%3D1000000000000000000");

        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.UnprocessableEntity,
            HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GetSales_ShouldReturnEmpty_WhenFilterMatchesNothing()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/transparency/sales?filter=seller%3D0xnonexistent");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetSales_ShouldNotOverflow_WhenPriceExceedsDecimalMaxValue_ViaEfProjection()
    {
        var overflowPrice = BigInteger.Pow(2, 200);
        var overflowRoyalty = BigInteger.Pow(2, 201);
        var overflowFee = BigInteger.Pow(2, 202);

        await using var conn = new NpgsqlConnection(factory.ConnectionString);
        await conn.OpenAsync();

        await using var insertCmd = conn.CreateCommand();
        insertCmd.CommandText = $"""
            INSERT INTO indexer.sales (id, token_id, seller, buyer, price, platform_fee, royalty, block_number)
            VALUES ('sale-overflow', 42, '0xseller-overflow', '0xbuyer-overflow',
                    {overflowPrice}, {overflowFee}, {overflowRoyalty}, 9999)
            ON CONFLICT (id) DO UPDATE
                SET price = excluded.price,
                    platform_fee = excluded.platform_fee,
                    royalty = excluded.royalty
            """;
        await insertCmd.ExecuteNonQueryAsync();

        var client = factory.CreateClient();
        var response = await client.GetAsync(
            "/transparency/sales?filter=seller%3D0xseller-overflow");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<SaleDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);

        var sale = result.Items[0];
        sale.Price.Should().Be(overflowPrice.ToString(),
            "Npgsql native numeric(78,0)→BigInteger must round-trip values far beyond decimal.MaxValue");
        sale.Royalty.Should().Be(overflowRoyalty.ToString(),
            "royalty column must also survive values beyond decimal range through the EF Select projection");
        sale.PlatformFee.Should().Be(overflowFee.ToString(),
            "platform_fee column must also survive values beyond decimal range through the EF Select projection");
    }
}
