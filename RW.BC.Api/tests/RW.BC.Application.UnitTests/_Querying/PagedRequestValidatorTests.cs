using FluentValidation.TestHelper;
using RW.BC.Application._Querying;

namespace RW.BC.Application.UnitTests._Querying;

public sealed class PagedRequestValidatorTests
{
    private readonly PagedRequestValidator _validator = new();

    [Theory]
    [InlineData(1, 1)]
    [InlineData(1, 9)]
    [InlineData(1, 10)]
    [InlineData(1, 20)]
    [InlineData(100, 50)]
    [InlineData(200, 100)]
    public void Validate_ShouldPass_WhenRequestIsWithinLimits(int page, int pageSize)
    {
        var request = new PagedRequest(page, pageSize, null, null);

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData(0, 20)]
    [InlineData(-1, 20)]
    [InlineData(201, 20)]
    public void Validate_ShouldFail_WhenPageIsOutOfRange(int page, int pageSize)
    {
        var request = new PagedRequest(page, pageSize, null, null);

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Page);
    }

    [Theory]
    [InlineData(1, 0)]
    [InlineData(1, -1)]
    [InlineData(1, 101)]
    [InlineData(1, 200)]
    public void Validate_ShouldFail_WhenPageSizeIsOutOfRange(int page, int pageSize)
    {
        var request = new PagedRequest(page, pageSize, null, null);

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.PageSize);
    }

    [Fact]
    public void Validate_ShouldFail_WhenFilterExceedsMaxLength()
    {
        var longFilter = new string('x', GridifyHardLimits.MaxFilterLength + 1);
        var request = new PagedRequest(1, 20, longFilter, null);

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.Filter);
    }

    [Fact]
    public void Validate_ShouldPass_WhenFilterIsAtMaxLength()
    {
        var exactFilter = new string('x', GridifyHardLimits.MaxFilterLength);
        var request = new PagedRequest(1, 20, exactFilter, null);

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveValidationErrorFor(r => r.Filter);
    }

    [Fact]
    public void Validate_ShouldFail_WhenOrderByExceedsMaxLength()
    {
        var longOrderBy = new string('x', GridifyHardLimits.MaxOrderByLength + 1);
        var request = new PagedRequest(1, 20, null, longOrderBy);

        var result = _validator.TestValidate(request);

        result.ShouldHaveValidationErrorFor(r => r.OrderBy);
    }

    [Fact]
    public void Validate_ShouldPass_WhenFilterAndOrderByAreNull()
    {
        var request = new PagedRequest(1, 10, null, null);

        var result = _validator.TestValidate(request);

        result.ShouldNotHaveAnyValidationErrors();
    }
}
