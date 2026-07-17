using FluentValidation;

namespace RW.BC.Application.Transparency.Queries.GetSales;

public sealed class GetSalesQueryValidator : AbstractValidator<GetSalesQuery>
{
    public GetSalesQueryValidator(IValidator<_Querying.PagedRequest> pagedRequestValidator)
    {
        RuleFor(q => q.Request).SetValidator(pagedRequestValidator);
    }
}
