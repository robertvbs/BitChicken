namespace RW.BC.Application._Querying;

public sealed record PagedRequest(
    int Page,
    int PageSize,
    string? Filter,
    string? OrderBy);
