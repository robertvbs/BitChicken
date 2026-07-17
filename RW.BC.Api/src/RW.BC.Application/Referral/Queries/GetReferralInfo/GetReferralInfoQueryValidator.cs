using FluentValidation;

namespace RW.BC.Application.Referral.Queries.GetReferralInfo;

public sealed class GetReferralInfoQueryValidator : AbstractValidator<GetReferralInfoQuery>
{
    public GetReferralInfoQueryValidator()
    {
        RuleFor(q => q.Address)
            .Cascade(CascadeMode.Stop)
            .NotEmpty()
            .Matches("^0x[0-9a-fA-F]{40}$")
            .WithMessage("{PropertyName} must be a valid EVM wallet address.");
    }
}
