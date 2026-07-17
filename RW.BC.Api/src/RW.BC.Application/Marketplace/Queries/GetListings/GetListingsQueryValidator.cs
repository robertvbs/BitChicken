using FluentValidation;

namespace RW.BC.Application.Marketplace.Queries.GetListings;

public sealed class GetListingsQueryValidator : AbstractValidator<GetListingsQuery>
{
    public GetListingsQueryValidator(IValidator<_Querying.PagedRequest> pagedRequestValidator)
    {
        RuleFor(q => q.Request).SetValidator(pagedRequestValidator);
    }
}
