using FluentValidation;

namespace RW.BC.Application.Staking.Queries.GetAccountStaking;

public sealed class GetAccountStakingQueryValidator : AbstractValidator<GetAccountStakingQuery>
{
    public GetAccountStakingQueryValidator(IValidator<_Querying.PagedRequest> pagedRequestValidator)
    {
        RuleFor(q => q.Address)
            .Cascade(CascadeMode.Stop)
            .NotEmpty()
            .Matches("^0x[0-9a-fA-F]{40}$")
            .WithMessage("{PropertyName} must be a valid EVM wallet address.");
        RuleFor(q => q.Request).SetValidator(pagedRequestValidator);
    }
}
