using System.Net;
using FluentAssertions;
using RW.BC.Api.Hubs;
using RW.BC.Api.IntegrationTests.Infrastructure;
using Xunit;

namespace RW.BC.Api.IntegrationTests.Realtime;

[Collection("Api")]
public sealed class EventsHubTests(ApiWebApplicationFactory factory)
{
    [Fact]
    public async Task NegotiateEndpoint_ShouldReturn200_WhenHubIsMapped()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsync("/hubs/events/negotiate?negotiateVersion=1", null);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public void EventsHub_ShouldExposeSubscribeMethod()
    {
        var method = typeof(EventsHub).GetMethod(nameof(EventsHub.Subscribe));

        method.Should().NotBeNull("Subscribe is the public contract for address-based group routing");
        method!.GetParameters().Should().HaveCount(1);
        method.GetParameters()[0].ParameterType.Should().Be(typeof(string));
    }

    [Fact]
    public void EventsHub_ShouldExposeUnsubscribeMethod()
    {
        var method = typeof(EventsHub).GetMethod(nameof(EventsHub.Unsubscribe));

        method.Should().NotBeNull();
        method!.GetParameters().Should().HaveCount(1);
        method.GetParameters()[0].ParameterType.Should().Be(typeof(string));
    }
}
