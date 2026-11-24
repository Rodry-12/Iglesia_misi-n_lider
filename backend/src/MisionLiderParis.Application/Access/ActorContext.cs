namespace MisionLiderParis.Application.Access;

public sealed class ActorContext
{
    public Guid? UserId { get; private set; }
    public string? SessionStamp { get; private set; }
    public void BindAuthenticatedSession(Guid id,string stamp)
    {
        SetUser(id);
        if (string.IsNullOrWhiteSpace(stamp) || (SessionStamp is not null && SessionStamp != stamp))
            throw Common.ApiException.Forbidden();
        SessionStamp=stamp;
    }
    public void SetUser(Guid id)
    {
        if (id == Guid.Empty || (UserId.HasValue && UserId != id)) throw Common.ApiException.Forbidden();
        UserId = id;
    }
}
