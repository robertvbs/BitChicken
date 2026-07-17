using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using OpenTelemetry;

namespace RW.BC.ServiceDefaults;

[ExcludeFromCodeCoverage]
internal sealed class NoiseFilterProcessor : BaseProcessor<Activity>
{
    private static readonly HashSet<string> SuppressedSources =
    [
        "Wolverine",
        "Wolverine.MessageBus",
        "Wolverine.Transports",
    ];

    public override void OnStart(Activity data)
    {
        if (ShouldSuppress(data))
            data.IsAllDataRequested = false;
    }

    public override void OnEnd(Activity data)
    {
        if (ShouldSuppress(data))
            data.ActivityTraceFlags &= ~ActivityTraceFlags.Recorded;
    }

    private static bool ShouldSuppress(Activity data)
    {
        if (SuppressedSources.Contains(data.Source.Name))
            return true;

        if (data.OperationName is "db" or "db.query.text")
            return true;

        return false;
    }
}
