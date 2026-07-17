using Nethereum.Signer;
using RW.BC.Application.Accounts.Ports;

namespace RW.BC.Infrastructure.Persistence.Security;

public sealed class NethereumSignatureVerifier : ISignatureVerifier
{
    private readonly EthereumMessageSigner _signer = new();

    public string RecoverAddress(string message, string signature)
    {
        return _signer.EncodeUTF8AndEcRecover(message, signature);
    }
}
