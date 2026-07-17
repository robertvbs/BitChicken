using Nethereum.Signer;
using RW.BC.Infrastructure.Persistence.Security;

namespace RW.BC.Infrastructure.Persistence.IntegrationTests;

public sealed class NethereumSignatureVerifierTests
{
    private const string PrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

    [Fact]
    public void RecoverAddress_ShouldReturnSignerAddress_ForGenuineSignature()
    {
        const string message = "Link this wallet to your BitChicken account\n\nAccount: acct-1\nNonce: deadbeef";
        var key = new EthECKey(PrivateKey);
        var expectedAddress = key.GetPublicAddress();
        var signature = new EthereumMessageSigner().EncodeUTF8AndSign(message, key);

        var sut = new NethereumSignatureVerifier();
        var recovered = sut.RecoverAddress(message, signature);

        recovered.Should().BeEquivalentTo(expectedAddress);
    }

    [Fact]
    public void RecoverAddress_ShouldReturnDifferentAddress_WhenMessageTampered()
    {
        const string message = "Link this wallet to your BitChicken account\n\nNonce: original";
        var key = new EthECKey(PrivateKey);
        var signature = new EthereumMessageSigner().EncodeUTF8AndSign(message, key);

        var sut = new NethereumSignatureVerifier();
        var recovered = sut.RecoverAddress("Link this wallet to your BitChicken account\n\nNonce: tampered", signature);

        recovered.Should().NotBe(key.GetPublicAddress());
    }
}
