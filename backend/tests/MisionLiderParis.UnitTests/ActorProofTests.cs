using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.UnitTests;

public sealed class ActorProofTests
{
    [Fact]
    public void ProofAuthenticatesCanonicalPayloadAndPersonIntent()
    {
        var key=RandomNumberGenerator.GetBytes(32);
        var signer=new ActorProof(Options.Create(new ActorProofOptions {KeyId="unit",SigningKeyBase64=Convert.ToBase64String(key)}));
        var person=Guid.NewGuid(); var branch=Guid.NewGuid();
        var token=signer.Sign(Guid.NewGuid(),"STAMP","42",101,"isolated_tests","runtime",DateTimeOffset.UtcNow.AddSeconds(60),person,branch).Split('.');
        var payload=Convert.FromBase64String(token[0]);
        Assert.True(CryptographicOperations.FixedTimeEquals(HMACSHA256.HashData(key,payload),Convert.FromBase64String(token[1])));
        var fields=Encoding.UTF8.GetString(payload).Split('|');
        Assert.Equal(11,fields.Length); Assert.Equal(person.ToString(),fields[9]); Assert.Equal(branch.ToString(),fields[10]);
    }

    [Fact]
    public void ProofChangesWithTransactionBinding()
    {
        var signer=new ActorProof(Options.Create(new ActorProofOptions {KeyId="unit",SigningKeyBase64=Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))}));
        var actor=Guid.NewGuid(); var expires=DateTimeOffset.UtcNow.AddSeconds(60);
        Assert.NotEqual(signer.Sign(actor,"STAMP","1",1,"tests","runtime",expires),signer.Sign(actor,"STAMP","2",1,"tests","runtime",expires));
        Assert.NotEqual(signer.Sign(actor,"STAMP","1",1,"tests","runtime",expires),signer.Sign(actor,"STAMP","1",2,"tests","runtime",expires));
    }

    [Theory]
    [InlineData(0)] [InlineData(16)]
    public void WeakSigningKeysAreRejected(int length)
    {
        var signer=new ActorProof(Options.Create(new ActorProofOptions {KeyId="unit",SigningKeyBase64=Convert.ToBase64String(RandomNumberGenerator.GetBytes(length))}));
        Assert.Throws<InvalidOperationException>(()=>signer.Sign(Guid.NewGuid(),"STAMP","1",1,"tests","runtime",DateTimeOffset.UtcNow));
    }

    [Fact]
    public void EmptyActorAndIncompleteWriteIntentAreRejected()
    {
        var signer=new ActorProof(Options.Create(new ActorProofOptions {KeyId="unit",SigningKeyBase64=Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))}));
        Assert.Throws<InvalidOperationException>(()=>signer.Sign(Guid.Empty,"STAMP","1",1,"tests","runtime",DateTimeOffset.UtcNow));
        Assert.Throws<InvalidOperationException>(()=>signer.Sign(Guid.NewGuid(),"STAMP","1",1,"tests","runtime",DateTimeOffset.UtcNow,Guid.NewGuid()));
    }
}
