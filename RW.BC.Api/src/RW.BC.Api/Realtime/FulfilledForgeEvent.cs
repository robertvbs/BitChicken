namespace RW.BC.Api.Realtime;

internal sealed record FulfilledForgeEvent(
    string Buyer,
    string RequestId,
    string TokenId,
    string EditionId);
