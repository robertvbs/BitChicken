namespace RW.BC.Application.Accounts.Ports;

public interface ISignatureVerifier
{
    string RecoverAddress(string message, string signature);
}
