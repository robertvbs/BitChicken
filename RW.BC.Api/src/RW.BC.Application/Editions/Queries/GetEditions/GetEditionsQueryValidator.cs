using FluentValidation;

namespace RW.BC.Application.Editions.Queries.GetEditions;

public sealed class GetEditionsQueryValidator : AbstractValidator<GetEditionsQuery>
{
    public GetEditionsQueryValidator(IValidator<_Querying.PagedRequest> pagedRequestValidator)
    {
        RuleFor(q => q.Request).SetValidator(pagedRequestValidator);
    }
}
