using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Common;

namespace MisionLiderParis.UnitTests;

public sealed class ActorContextTests
{
    [Fact]
    public void AuthenticatedSessionStampCannotBeReplaced()
    {
        var actor=new ActorContext();var id=Guid.NewGuid();actor.BindAuthenticatedSession(id,"first");
        Assert.Throws<ApiException>(()=>actor.BindAuthenticatedSession(id,"second"));
        Assert.Equal("first",actor.SessionStamp);
    }
    [Fact]
    public void ActorCannotBeReplacedWithinTheRequest()
    {
        var actor = new ActorContext(); var original = Guid.NewGuid(); actor.SetUser(original);
        Assert.Throws<ApiException>(() => actor.SetUser(Guid.NewGuid()));
        Assert.Equal(original, actor.UserId);
    }

    [Fact]
    public void ReapplyingSameActorIsAllowedButEmptyActorIsRejected()
    {
        var actor = new ActorContext(); var original = Guid.NewGuid();
        actor.SetUser(original); actor.SetUser(original);
        Assert.Throws<ApiException>(() => actor.SetUser(Guid.Empty));
        Assert.Equal(original, actor.UserId);
    }
}
