using FluentValidation;

namespace RW.BC.Application._Querying;

public sealed class PagedRequestValidator : AbstractValidator<PagedRequest>
{
    public PagedRequestValidator()
    {
        RuleFor(q => q.Page)
            .InclusiveBetween(GridifyHardLimits.MinPage, GridifyHardLimits.MaxPage)
            .WithMessage(
                $"{{PropertyName}} must be between {GridifyHardLimits.MinPage} and {GridifyHardLimits.MaxPage}.");

        RuleFor(q => q.PageSize)
            .InclusiveBetween(GridifyHardLimits.MinPageSize, GridifyHardLimits.MaxPageSize)
            .WithMessage(
                $"{{PropertyName}} must be between {GridifyHardLimits.MinPageSize} and {GridifyHardLimits.MaxPageSize}.");

        RuleFor(q => q.Filter)
            .MaximumLength(GridifyHardLimits.MaxFilterLength)
            .When(q => q.Filter is not null)
            .WithMessage($"{{PropertyName}} must not exceed {GridifyHardLimits.MaxFilterLength} characters.");

        RuleFor(q => q.OrderBy)
            .MaximumLength(GridifyHardLimits.MaxOrderByLength)
            .When(q => q.OrderBy is not null)
            .WithMessage($"{{PropertyName}} must not exceed {GridifyHardLimits.MaxOrderByLength} characters.");
    }
}
