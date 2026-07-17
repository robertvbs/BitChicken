using System.Diagnostics.CodeAnalysis;
using RW.BC.Application.Referral.Dtos;
using RW.BC.Application.Referral.Queries.GetReferralInfo;
using Wolverine;

namespace RW.BC.Api.Endpoints;

[ExcludeFromCodeCoverage]
public static class ReferralEndpoints
{
    public static void AddReferralEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/accounts").WithTags("Referral");

        group.MapGet("{address}/referral", async (
                string address,
                IMessageBus bus,
                CancellationToken cancellationToken) =>
            {
                var query = new GetReferralInfoQuery(address);
                var result = await bus.InvokeAsync<ReferralInfoDto>(query, cancellationToken);
                return Results.Ok(result);
            })
            .WithName("GetReferralInfo")
            .Produces<ReferralInfoDto>()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status422UnprocessableEntity);
    }
}
