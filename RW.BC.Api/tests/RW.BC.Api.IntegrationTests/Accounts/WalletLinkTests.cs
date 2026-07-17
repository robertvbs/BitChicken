using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Nethereum.Signer;
using RW.BC.Api.IntegrationTests.Infrastructure;
using RW.BC.Application.Accounts.Dtos;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Accounts;

[Collection("Api")]
public sealed class WalletLinkTests(ApiWebApplicationFactory factory)
{
    private static EthECKey NewKey() => EthECKey.GenerateKey();

    private static string NewUid() => "uid-wallet-" + Guid.NewGuid().ToString("N")[..12];

    private async Task<(HttpClient client, string uid, AccountDto account)> ProvisionAccount(
        string? displayName = "Wallet_1")
    {
        var uid = NewUid();
        var client = factory.CreateAuthenticatedClient(uid, $"{uid}@example.com", displayName);
        var response = await client.GetAsync("/accounts/me");
        response.EnsureSuccessStatusCode();
        var dto = await response.Content.ReadFromJsonAsync<AccountDto>();
        return (client, uid, dto!);
    }

    [Fact]
    public async Task RequestNonce_ShouldReturn200_WithMessage()
    {
        var (client, _, _) = await ProvisionAccount();

        var response = await client.PostAsync("/accounts/me/wallet/nonce", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();
        dto.Should().NotBeNull();
        dto!.Nonce.Should().NotBeNullOrEmpty();
        dto.Message.Should().Contain(dto.Nonce);
    }

    [Fact]
    public async Task LinkWallet_ShouldReturn200_WithLinkedWallet()
    {
        var (client, _, _) = await ProvisionAccount();

        var nonceResponse = await client.PostAsync("/accounts/me/wallet/nonce", null);
        var challenge = await nonceResponse.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();

        var key = NewKey();
        var address = key.GetPublicAddress();
        var signature = new EthereumMessageSigner().EncodeUTF8AndSign(challenge!.Message, key);

        var linkResponse = await client.PostAsJsonAsync("/accounts/me/wallet", new
        {
            address,
            signature
        });

        linkResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await linkResponse.Content.ReadFromJsonAsync<AccountDto>();
        dto!.WalletLinked.Should().BeTrue();
        dto.WalletAddress.Should().BeEquivalentTo(address);
    }

    [Fact]
    public async Task LinkWallet_ShouldReturn409_WhenWalletAlreadyLinkedToAnotherAccount()
    {
        var sharedKey = NewKey();
        var address = sharedKey.GetPublicAddress();

        var (client1, _, _) = await ProvisionAccount("First_1");
        var nonceResp1 = await client1.PostAsync("/accounts/me/wallet/nonce", null);
        var challenge1 = await nonceResp1.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();
        var sig1 = new EthereumMessageSigner().EncodeUTF8AndSign(challenge1!.Message, sharedKey);
        var link1 = await client1.PostAsJsonAsync("/accounts/me/wallet", new { address, signature = sig1 });
        link1.StatusCode.Should().Be(HttpStatusCode.OK);

        var (client2, _, _) = await ProvisionAccount("Secnd_2");
        var nonceResp2 = await client2.PostAsync("/accounts/me/wallet/nonce", null);
        var challenge2 = await nonceResp2.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();
        var sig2 = new EthereumMessageSigner().EncodeUTF8AndSign(challenge2!.Message, sharedKey);
        var link2 = await client2.PostAsJsonAsync("/accounts/me/wallet", new { address, signature = sig2 });

        link2.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RequestNonce_ShouldReturn409_WhenWalletAlreadyLinked()
    {
        var (client, _, _) = await ProvisionAccount();

        var nonceResp = await client.PostAsync("/accounts/me/wallet/nonce", null);
        var challenge = await nonceResp.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();
        var key = NewKey();
        var address = key.GetPublicAddress();
        var sig = new EthereumMessageSigner().EncodeUTF8AndSign(challenge!.Message, key);
        var linkResp = await client.PostAsJsonAsync("/accounts/me/wallet", new { address, signature = sig });
        linkResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var secondNonce = await client.PostAsync("/accounts/me/wallet/nonce", null);

        secondNonce.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RequestNonce_ShouldReturnSameChallenge_WhenCalledTwiceBeforeExpiry()
    {
        var (client, _, _) = await ProvisionAccount();

        var first = await client.PostAsync("/accounts/me/wallet/nonce", null);
        var second = await client.PostAsync("/accounts/me/wallet/nonce", null);

        first.StatusCode.Should().Be(HttpStatusCode.OK);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto1 = await first.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();
        var dto2 = await second.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();
        dto1!.Nonce.Should().Be(dto2!.Nonce, "a valid non-expired nonce must not be replaced on a second request");
    }

    [Fact]
    public async Task UnlinkWallet_ShouldReturn200_WithUnlinkedWallet()
    {
        var (client, _, _) = await ProvisionAccount();

        var nonceResp = await client.PostAsync("/accounts/me/wallet/nonce", null);
        var challenge = await nonceResp.Content.ReadFromJsonAsync<WalletLinkChallengeDto>();
        var key = NewKey();
        var address = key.GetPublicAddress();
        var sig = new EthereumMessageSigner().EncodeUTF8AndSign(challenge!.Message, key);
        await client.PostAsJsonAsync("/accounts/me/wallet", new { address, signature = sig });

        var unlinkResponse = await client.DeleteAsync("/accounts/me/wallet");

        unlinkResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await unlinkResponse.Content.ReadFromJsonAsync<AccountDto>();
        dto!.WalletLinked.Should().BeFalse();
        dto.WalletAddress.Should().BeNull();
    }
}
