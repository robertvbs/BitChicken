using FluentValidation;

namespace RW.BC.Application.Forge.Queries.GetAccountForgeRequests;

public sealed class GetAccountForgeRequestsQueryValidator : AbstractValidator<GetAccountForgeRequestsQuery>
{
    public GetAccountForgeRequestsQueryValidator(IValidator<_Querying.PagedRequest> pagedRequestValidator)
    {
        RuleFor(q => q.Address)
            .Cascade(CascadeMode.Stop)
            .NotEmpty()
            .Matches("^0x[0-9a-fA-F]{40}$")
            .WithMessage("{PropertyName} must be a valid EVM wallet address.");
        RuleFor(q => q.Request).SetValidator(pagedRequestValidator);
    }
}
