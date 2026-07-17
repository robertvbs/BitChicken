using System.Diagnostics.CodeAnalysis;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;

namespace RW.BC.Api.Hubs;

[ExcludeFromCodeCoverage]
public sealed partial class EventsHub : Hub
{
    public Task Subscribe(string address)
    {
        if (!EvmAddressRegex().IsMatch(address))
            throw new HubException("Invalid address.");
        return Groups.AddToGroupAsync(Context.ConnectionId, address.ToLowerInvariant());
    }

    public Task Unsubscribe(string address) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, address.ToLowerInvariant());

    [GeneratedRegex(@"^0x[0-9a-fA-F]{40}$")]
    private static partial Regex EvmAddressRegex();
}
