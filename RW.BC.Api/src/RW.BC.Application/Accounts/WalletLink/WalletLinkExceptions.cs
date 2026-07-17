using RW.BC.Application.Abstractions;

namespace RW.BC.Application.Accounts.WalletLink;

public sealed class WalletLinkNonceUnavailableException(string message) : AppException(message);

public sealed class WalletLinkSignatureInvalidException(string message) : AppException(message);

public sealed class WalletAlreadyLinkedException(string message) : AppException(message);
