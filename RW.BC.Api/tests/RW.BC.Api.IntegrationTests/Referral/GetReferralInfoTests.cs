using System.Net;
using System.Net.Http.Json;
using System.Numerics;
using FluentAssertions;
using Npgsql;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application.Referral.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Referral;

[Collection("Api")]
public sealed class GetReferralInfoTests(ApiWebApplicationFactory factory) : IAsyncLifetime
{
    private static readonly string IndexerViewsSql = File.ReadAllText(
        Path.Combine(AppContext.BaseDirectory, "_Fixtures", "indexer-views.sql"));

    private const string ReferrerAddress = "0xaabbccdd00000000000000000000000000000001";
    private const string BuyerAddress = "0xaabbccdd00000000000000000000000000000002";
    private const string UnknownAddress = "0xffffffffffffffffffffffffffffffffffffffff";

    public async Task InitializeAsync()
    {
        await using var conn = new NpgsqlConnection(factory.ConnectionString);
        await conn.OpenAsync();

        await using var setupCmd = conn.CreateCommand();
        setupCmd.CommandText = IndexerViewsSql;
        await setupCmd.ExecuteNonQueryAsync();

        await SeedAsync(conn);
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task SeedAsync(NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            TRUNCATE indexer.referral_registrations, indexer.referral_links,
                     indexer.referral_bnb_accruals, indexer.referral_bnb_claims;

            INSERT INTO indexer.referral_registrations (referrer, code, block_number)
            VALUES ('0xaabbccdd00000000000000000000000000000001', 12345, 100);

            INSERT INTO indexer.referral_links (buyer, referrer, block_number)
            VALUES
                ('0xaabbccdd00000000000000000000000000000002', '0xaabbccdd00000000000000000000000000000001', 110),
                ('0xaabbccdd00000000000000000000000000000003', '0xaabbccdd00000000000000000000000000000001', 120);

            INSERT INTO indexer.referral_bnb_accruals (id, referrer, buyer, amount, block_number)
            VALUES
                ('c1', '0xaabbccdd00000000000000000000000000000001', '0xaabbccdd00000000000000000000000000000002', 1000000000000000000, 200),
                ('c2', '0xaabbccdd00000000000000000000000000000001', '0xaabbccdd00000000000000000000000000000003', 500000000000000000, 210);

            INSERT INTO indexer.referral_bnb_claims (id, referrer, amount, block_number)
            VALUES
                ('cl1', '0xaabbccdd00000000000000000000000000000001', 300000000000000000, 300);
            """;
        await cmd.ExecuteNonQueryAsync();
    }

    [Fact]
    public async Task GetReferralInfo_ShouldReturn200_WithoutAuth()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{ReferrerAddress}/referral");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetReferralInfo_ShouldReturnCode_WhenAddressIsRegistered()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{ReferrerAddress}/referral");

        var result = await response.Content.ReadFromJsonAsync<ReferralInfoDto>();
        result.Should().NotBeNull();
        result!.Code.Should().Be("12345");
    }

    [Fact]
    public async Task GetReferralInfo_ShouldReturnUpline_WhenAddressHasReferrer()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{BuyerAddress}/referral");

        var result = await response.Content.ReadFromJsonAsync<ReferralInfoDto>();
        result.Should().NotBeNull();
        result!.Upline.Should().Be(ReferrerAddress);
    }

    [Fact]
    public async Task GetReferralInfo_ShouldReturnReferralCount_WhenAddressHasReferrals()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{ReferrerAddress}/referral");

        var result = await response.Content.ReadFromJsonAsync<ReferralInfoDto>();
        result.Should().NotBeNull();
        result!.ReferralCount.Should().Be(2);
    }

    [Fact]
    public async Task GetReferralInfo_ShouldReturnCorrectPending_AsAccruedMinusClaimed()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{ReferrerAddress}/referral");

        var result = await response.Content.ReadFromJsonAsync<ReferralInfoDto>();
        result.Should().NotBeNull();

        var expectedAccrued = new BigInteger(1000000000000000000) + new BigInteger(500000000000000000);
        var expectedClaimed = new BigInteger(300000000000000000);
        var expectedPending = expectedAccrued - expectedClaimed;

        result!.TotalAccrued.Should().Be(expectedAccrued.ToString());
        result.TotalClaimed.Should().Be(expectedClaimed.ToString());
        result.Pending.Should().Be(expectedPending.ToString());
    }

    [Fact]
    public async Task GetReferralInfo_ShouldReturnZerosAndNulls_WhenAddressIsUnknown()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync($"/accounts/{UnknownAddress}/referral");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ReferralInfoDto>();
        result.Should().NotBeNull();
        result!.Code.Should().BeNull();
        result.Upline.Should().BeNull();
        result.ReferralCount.Should().Be(0);
        result.TotalAccrued.Should().Be("0");
        result.TotalClaimed.Should().Be("0");
        result.Pending.Should().Be("0");
    }

    [Fact]
    public async Task GetReferralInfo_ShouldNormalizeAddress_CaseInsensitive()
    {
        var client = factory.CreateClient();
        var mixedCase = "0xAABBCCDD00000000000000000000000000000001";

        var response = await client.GetAsync($"/accounts/{mixedCase}/referral");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ReferralInfoDto>();
        result.Should().NotBeNull();
        result!.Code.Should().Be("12345", "uppercase address must resolve the same as lowercase");
        result.ReferralCount.Should().Be(2);
    }

    [Fact]
    public async Task GetReferralInfo_ShouldNotOverflow_WhenAccruedApproachesUint256Max()
    {
        await using var conn = new NpgsqlConnection(factory.ConnectionString);
        await conn.OpenAsync();

        const string bigAddress = "0x000000000000000000000000000000000000beef";
        var nearMax = BigInteger.Pow(2, 255);

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            INSERT INTO indexer.referral_bnb_accruals (id, referrer, buyer, amount, block_number)
            VALUES ('c-big', '{bigAddress}', '{bigAddress}', {nearMax}, 999)
            """;
        await cmd.ExecuteNonQueryAsync();

        var client = factory.CreateClient();
        var response = await client.GetAsync($"/accounts/{bigAddress}/referral");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ReferralInfoDto>();
        result.Should().NotBeNull();
        result!.TotalAccrued.Should().Be(nearMax.ToString(),
            "SQL SUM::text must survive values far beyond decimal range");
        result.Pending.Should().Be(nearMax.ToString(),
            "pending = accrued - claimed (0) must not overflow");
    }
}
