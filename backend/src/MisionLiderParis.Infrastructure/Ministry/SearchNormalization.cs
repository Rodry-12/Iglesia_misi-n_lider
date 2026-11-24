namespace MisionLiderParis.Infrastructure.Ministry;

// PostgreSQL translate removes combining marks after folding common Latin accents.
// Apply the same mapping to stored text and search input; never rewrite stored data.
internal static class SearchNormalization
{
    internal static readonly string Characters =
        "ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇáàâäãåéèêëíìîïóòôöõúùûüñç" +
        new string(Enumerable.Range(0x0300, 0x70).Select(value => (char)value).ToArray());
    internal const string Replacements = "AAAAAAEEEEIIIIOOOOOUUUUNCaaaaaaeeeeiiiiooooouuuunc";
}
