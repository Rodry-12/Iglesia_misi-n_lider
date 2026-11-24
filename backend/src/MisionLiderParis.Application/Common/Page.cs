namespace MisionLiderParis.Application.Common;

public sealed record Page<T>(IReadOnlyList<T> Items, int PageNumber, int PageSize, int TotalCount);

public readonly record struct PageRequest(int PageNumber = 1, int PageSize = 25)
{
    public int Offset
    {
        get
        {
            if (PageNumber < 1 || PageNumber > 100_000 || PageSize < 1 || PageSize > 100)
                throw ApiException.Invalid("La página debe estar entre 1 y 100000 y el tamaño entre 1 y 100.");
            return checked((PageNumber - 1) * PageSize);
        }
    }
}
