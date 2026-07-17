using System.Net;
using System.Net.Http.Json;
using System.Text;
using FluentAssertions;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application._Querying;
using RW.BC.Application.Staking.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Staking;

[Collection("Api")]
public sealed class GetAccountStakingTests(ApiWebApplicationFactory factory) : IAsyncLifetime
{
    private static readonly string IndexerViewsSql = File.ReadAllText(
        Path.Combine(AppContext.BaseDirectory, "_Fixtures", "indexer-views.sql"));

    private const string StakerA = "0xaaaa000000000000000000000000000000000001";
    private const string StakerB = "0xbbbb000000000000000000000000000000000002";

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
        await using var truncateCmd = conn.CreateCommand();
        truncateCmd.CommandText = "TRUNCATE indexer.staking_pairs;";
        await truncateCmd.ExecuteNonQueryAsync();

        var sb = new StringBuilder();
        sb.AppendLine("INSERT INTO indexer.staking_pairs (pair_id, staker, male_id, female_id, matched, staked_at, last_claim_at, status) VALUES");

        var rows = new List<string>();

        for (var i = 1; i <= 150; i++)
        {
            var status = i <= 140 ? "Staked" : "Unstaked";
            rows.Add($"({i}, '{StakerA}', {i * 2}, {i * 2 + 1}, true, 1700000000, 1700010000, '{status}')");
        }

        rows.Add($"(200, '{StakerB}', 400, 401, false, 1700000000, 1700010000, 'Staked')");
        rows.Add($"(201, '{StakerB}', 402, 403, true,  1700000000, 1700010000, 'Unstaked')");

        sb.Append(string.Join(",\n", rows));
        sb.Append(';');

        await using var insertCmd = conn.CreateCommand();
        insertCmd.CommandText = sb.ToString();
        await insertCmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetAccountStaking_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{StakerA}/staking");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetAccountStaking_ShouldReturnOnlyStakerPairs()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{StakerA}/staking?pageSize=100");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(140, "server-side filter returns only Staked pairs; StakerA has 140 Staked of 150 total");
        result.Items.Should().HaveCount(100, "page 1 of 100 returns 100 items");
        result.Items.Should().AllSatisfy(p =>
        {
            var pairId = long.Parse(p.PairId);
            pairId.Should().BeInRange(1, 140, "Unstaked pairs (141-150) must be excluded");
        });
    }

    [Fact]
    public async Task GetAccountStaking_ShouldExcludeOtherStakers()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{StakerB}/staking?pageSize=100");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1, "StakerB owns 2 pairs total but only 1 is Staked (pair 200); pair 201 is Unstaked and excluded server-side");
    }

    [Fact]
    public async Task GetAccountStaking_ShouldPaginateBeyond100()
    {
        var client = factory.CreateClient();

        var page1 = await client.GetFromJsonAsync<PagedResponse<StakingPairDto>>(
            $"/accounts/{StakerA}/staking?page=1&pageSize=100");
        var page2 = await client.GetFromJsonAsync<PagedResponse<StakingPairDto>>(
            $"/accounts/{StakerA}/staking?page=2&pageSize=100");

        page1.Should().NotBeNull();
        page2.Should().NotBeNull();

        page1!.TotalCount.Should().Be(140);
        page1.Items.Should().HaveCount(100);

        page2!.TotalCount.Should().Be(140);
        page2.Items.Should().HaveCount(40, "page 2 holds the remaining 40 of 140 Staked pairs");

        var page1Ids = page1.Items.Select(p => p.PairId).ToHashSet();
        var page2Ids = page2.Items.Select(p => p.PairId).ToHashSet();
        page1Ids.Should().NotIntersectWith(page2Ids, "pages must not overlap");
    }

    [Fact]
    public async Task GetAccountStaking_ShouldFilterByStatus()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/accounts/{StakerA}/staking?filter=status%3DStaked&pageSize=100");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(140, "all 140 server-side Staked pairs pass the additional client filter status=Staked");
        result.Items.Should().AllSatisfy(p => p.Status.Should().Be("Staked"));
    }

    [Fact]
    public async Task GetAccountStaking_ShouldFilterByMatched()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/accounts/{StakerB}/staking?filter=matched%3Dfalse");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].Matched.Should().BeFalse();
        result.Items[0].PairId.Should().Be("200");
    }

    [Fact]
    public async Task GetAccountStaking_ShouldFilterByPairId()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/accounts/{StakerA}/staking?filter=pairId%3D42");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items[0].PairId.Should().Be("42");
    }

    [Fact]
    public async Task GetAccountStaking_ShouldOrderByPairId_Ascending()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/accounts/{StakerA}/staking?orderBy=pairId&pageSize=100");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        var ids = result!.Items.Select(p => long.Parse(p.PairId)).ToList();
        ids.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task GetAccountStaking_ShouldBeCaseInsensitive_OnAddress()
    {
        var client = factory.CreateClient();

        var mixedCase = "0xAAAA000000000000000000000000000000000001";
        var response = await client.GetAsync($"/accounts/{mixedCase}/staking?pageSize=100");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(140, "address is normalized to lowercase before querying; only Staked pairs returned");
    }

    [Fact]
    public async Task GetAccountStaking_ShouldExcludeUnstakedPairs_ServerSide()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{StakerA}/staking?pageSize=100&page=2");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().AllSatisfy(p => p.Status.Should().Be("Staked"),
            "Unstaked pairs (141–150 in seed) must never appear even without an explicit filter");
    }

    [Fact]
    public async Task GetAccountStaking_ShouldReturnEmpty_WhenStakerHasNoPairs()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/accounts/0xdeadbeef000000000000000000000000cafebabe/staking");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(0);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task GetAccountStaking_ShouldReturn422_WhenPageSizeExceedsMax()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/accounts/{StakerA}/staking?pageSize=101");

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task GetAccountStaking_ShouldReturn400OrError_WhenFilterReferencesNonWhitelistedField()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/accounts/{StakerA}/staking?filter=staker%3Dsomeaddress");

        response.StatusCode.Should().BeOneOf(
            HttpStatusCode.BadRequest,
            HttpStatusCode.UnprocessableEntity,
            HttpStatusCode.InternalServerError);
    }

    [Fact]
    public async Task GetAccountStaking_ShouldProjectTimestampsAsLong()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            $"/accounts/{StakerA}/staking?filter=pairId%3D1");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<PagedResponse<StakingPairDto>>();
        result.Should().NotBeNull();
        result!.Items.Should().HaveCount(1);

        var pair = result.Items[0];
        pair.PairId.Should().Be("1");
        pair.MaleId.Should().Be("2");
        pair.FemaleId.Should().Be("3");
        pair.Matched.Should().BeTrue();
        pair.StakedAt.Should().Be("1700000000");
        pair.LastClaimAt.Should().Be("1700010000");
        pair.Status.Should().Be("Staked");
    }
}
