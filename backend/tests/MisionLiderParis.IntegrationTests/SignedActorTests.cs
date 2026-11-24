using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Infrastructure.Ministry;
using Npgsql;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task SignedContextResolvesGlobalAccount()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        var manager=scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<MisionLiderParis.Infrastructure.Identity.ApplicationUser>>();
        var email=$"signed-{Guid.NewGuid():N}@example.invalid";
        var user=new MisionLiderParis.Infrastructure.Identity.ApplicationUser { Id=Guid.NewGuid(),Email=email,UserName=email,
            EmailConfirmed=true,DisplayName="Signed test",AccessGrants=[new() {RoleId=TestCatalog.GlobalRoleId}] };
        Assert.True((await manager.CreateAsync(user,Password)).Succeeded);
        await using (var connection=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE")))
        {
            await connection.OpenAsync(); await using var tx=await connection.BeginTransactionAsync();
            string token;
            await using (var challenge=new NpgsqlCommand("SELECT pg_current_xact_id()::text,pg_backend_pid(),current_database(),session_user",connection,tx))
            await using (var reader=await challenge.ExecuteReaderAsync())
            {
                await reader.ReadAsync();
                token=scope.ServiceProvider.GetRequiredService<ActorProof>().Sign(user.Id,user.SecurityStamp!,reader.GetString(0),reader.GetInt32(1),reader.GetString(2),reader.GetString(3),DateTimeOffset.UtcNow.AddSeconds(60));
            }
            await using var set=new NpgsqlCommand("SELECT set_config('mlp.actor_proof',@proof,true)",connection,tx);
            set.Parameters.AddWithValue("proof",token); await set.ExecuteNonQueryAsync();
            await using var admin=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_OPERATOR_DATABASE")); await admin.OpenAsync();
            await using var check=new NpgsqlCommand("""
                WITH p AS (SELECT string_to_array(convert_from(decode(split_part(@proof,'.',1),'base64'),'UTF8'),'|') f)
                SELECT array_length(p.f,1)=11,
                  public.hmac(convert_to(convert_from(decode(split_part(@proof,'.',1),'base64'),'UTF8'),'UTF8'),k.key_material,'sha256')=decode(split_part(@proof,'.',2),'base64'),
                  EXISTS(SELECT 1 FROM auth_app.users u WHERE u.id=p.f[3]::uuid AND u.security_stamp=p.f[4]),
                  p.f[5]::bigint>extract(epoch FROM clock_timestamp())
                FROM p JOIN auth_app.actor_context_keys k ON k.key_id=p.f[2]
                """,admin);
            check.Parameters.AddWithValue("proof",token);
            await using (var reader=await check.ExecuteReaderAsync())
            { Assert.True(await reader.ReadAsync()); for(int i=0;i<4;i++) Assert.True(reader.GetBoolean(i),"Proof validation component "+i); }
            await using var verify=new NpgsqlCommand("SELECT auth_app.verified_actor_id() IS NOT NULL",connection,tx);
            Assert.True((bool)(await verify.ExecuteScalarAsync())!,"SQL rejected a proof with valid MAC, stamp, shape and expiry");
            await tx.RollbackAsync();
        }
        Assert.True((await scope.ServiceProvider.GetRequiredService<IAccessService>().GetAsync(user.Id,CancellationToken.None)).IsGlobalAdministrator);
    }

    [PostgresFact]
    public async Task UnsignedGlobalActorCannotAuthenticateSqlContext()
    {
        var root = await AccountAsync(); using var client = root.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        await using var connection = new NpgsqlConnection(db.Database.GetConnectionString());
        await connection.OpenAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using var set = new NpgsqlCommand("SELECT set_config('mlp.actor_id', @actor, true), set_config('mlp.actor_proof','forged',true)",connection,transaction);
        set.Parameters.AddWithValue("actor",root.UserId.ToString()); await set.ExecuteNonQueryAsync();
        await using var query = new NpgsqlCommand("SELECT auth_app.has_global_access()",connection,transaction);
        Assert.False((bool)(await query.ExecuteScalarAsync())!);
        await transaction.RollbackAsync();
    }

    [PostgresFact]
    public async Task ActorProofDoesNotSurviveTransactionRollbackOnOpenConnection()
    {
        var root = await AccountAsync(); using var client = root.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        await db.Database.OpenConnectionAsync();
        await using (var transaction = await db.Database.BeginTransactionAsync())
        {
            Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT auth_app.has_global_access() AS \"Value\"").SingleAsync());
            await transaction.RollbackAsync();
        }
        await using var query = new NpgsqlCommand("SELECT auth_app.has_global_access()",(NpgsqlConnection)db.Database.GetDbConnection());
        Assert.False((bool)(await query.ExecuteScalarAsync())!);
    }

    [PostgresFact]
    public async Task RuntimeCannotReadOrChangeIdentityOrReadSigningKeys()
    {
        await using var connection=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE"));
        await connection.OpenAsync();
        foreach(var sql in new[] {"SELECT count(*) FROM auth_app.users", "SELECT count(*) FROM auth_app.actor_context_keys",
            "UPDATE auth_app.users SET is_active=false WHERE false", "DELETE FROM auth_app.user_access_grants WHERE false"})
        {
            await using var query=new NpgsqlCommand(sql,connection);
            var error=await Assert.ThrowsAsync<PostgresException>(()=>query.ExecuteNonQueryAsync());
            Assert.Equal("42501",error.SqlState);
        }
        await using var identity=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_IDENTITY_DATABASE")); await identity.OpenAsync();
        await using var keys=new NpgsqlCommand("SELECT count(*) FROM auth_app.actor_context_keys",identity);
        Assert.Equal("42501",(await Assert.ThrowsAsync<PostgresException>(()=>keys.ExecuteScalarAsync())).SqlState);
    }

    [PostgresFact]
    public async Task FailedAndCanceledQueriesRollbackAndLeaveContextUsable()
    {
        var root=await AccountAsync(); using var client=root.Client;
        await using var scope=factory.Services.CreateAsyncScope(); scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db=scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        Assert.Equal("on",await db.Database.SqlQueryRaw<string>("SELECT current_setting('transaction_read_only') AS \"Value\"").SingleAsync());
        await Assert.ThrowsAsync<PostgresException>(()=>db.Database.SqlQueryRaw<int>("SELECT 1/0 AS \"Value\"").SingleAsync());
        Assert.Null(db.Database.CurrentTransaction);
        using(var timeout=new CancellationTokenSource(TimeSpan.FromMilliseconds(200)))
            await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>db.Database.SqlQueryRaw<int>("SELECT 1 AS \"Value\" FROM pg_sleep(5)").SingleAsync(timeout.Token));
        Assert.Null(db.Database.CurrentTransaction);
        Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT auth_app.has_global_access() AS \"Value\"").SingleAsync());
        Assert.Null(db.Database.CurrentTransaction);
    }

    [PostgresFact]
    public async Task SignedProofExpiresCannotBeAlteredOrReplayedAndIsRevokedWithStamp()
    {
        var root=await AccountAsync(); using var client=root.Client;
        await using var scope=factory.Services.CreateAsyncScope();
        var manager=scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<MisionLiderParis.Infrastructure.Identity.ApplicationUser>>();
        var user=(await manager.FindByIdAsync(root.UserId.ToString()))!;
        var signer=scope.ServiceProvider.GetRequiredService<ActorProof>();
        await using var db=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE")); await db.OpenAsync();
        string token;
        await using(var tx=await db.BeginTransactionAsync())
        {
            string Sign(DateTimeOffset expiry,string xid,int pid,string database,string login) => signer.Sign(user.Id,user.SecurityStamp!,xid,pid,database,login,expiry);
            string xid,database,login; int pid;
            await using(var query=new NpgsqlCommand("SELECT pg_current_xact_id()::text,pg_backend_pid(),current_database(),session_user",db,tx))
            await using(var reader=await query.ExecuteReaderAsync()) { await reader.ReadAsync(); xid=reader.GetString(0);pid=reader.GetInt32(1);database=reader.GetString(2);login=reader.GetString(3); }
            async Task<bool> Accepted(string proof)
            {
                await using var set=new NpgsqlCommand("SELECT set_config('mlp.actor_proof',@proof,true)",db,tx); set.Parameters.AddWithValue("proof",proof); await set.ExecuteScalarAsync();
                await using var check=new NpgsqlCommand("SELECT auth_app.has_global_access()",db,tx); return (bool)(await check.ExecuteScalarAsync())!;
            }
            token=Sign(DateTimeOffset.UtcNow.AddSeconds(60),xid,pid,database,login);
            Assert.True(await Accepted(token));
            Assert.False(await Accepted(Sign(DateTimeOffset.UtcNow.AddSeconds(-1),xid,pid,database,login)));
            Assert.False(await Accepted(Sign(DateTimeOffset.UtcNow.AddSeconds(60),xid,pid+1,database,login)));
            var parts=token.Split('.'); var mac=Convert.FromBase64String(parts[1]); mac[0]^=1;
            Assert.False(await Accepted(parts[0]+"."+Convert.ToBase64String(mac)));
            Assert.False(await Accepted("malformed"));
            Assert.True(await Accepted(token));
            Assert.True((await manager.UpdateSecurityStampAsync(user)).Succeeded);
            Assert.False(await Accepted(token));
            await tx.CommitAsync();
        }
        await using(var tx=await db.BeginTransactionAsync())
        {
            await using var set=new NpgsqlCommand("SELECT set_config('mlp.actor_proof',@proof,true)",db,tx);set.Parameters.AddWithValue("proof",token);await set.ExecuteScalarAsync();
            await using var check=new NpgsqlCommand("SELECT auth_app.has_global_access()",db,tx);Assert.False((bool)(await check.ExecuteScalarAsync())!);
            await tx.RollbackAsync();
        }
        await using var absent=new NpgsqlCommand("SELECT auth_app.has_global_access()",db);Assert.False((bool)(await absent.ExecuteScalarAsync())!);
    }

    [PostgresFact]
    public async Task CommittedProofCannotReplayAndSingleConnectorPoolDoesNotLeakActor()
    {
        var root=await AccountAsync(); using var client=root.Client;
        await using var scope=factory.Services.CreateAsyncScope(); scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var installer=scope.ServiceProvider.GetRequiredService<ActorTransactionContext>();
        var settings=new NpgsqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE")) {MaxPoolSize=1,ApplicationName="signed-context-pool-regression"};
        string token; int pid;
        await using(var connection=new NpgsqlConnection(settings.ConnectionString))
        {
            await connection.OpenAsync(); pid=connection.ProcessID;
            await using(var tx=await connection.BeginTransactionAsync())
            {
                await installer.InstallAsync(connection,tx,false,CancellationToken.None);
                await using var query=new NpgsqlCommand("SELECT current_setting('mlp.actor_proof')",connection,tx);token=(string)(await query.ExecuteScalarAsync())!;
                await tx.CommitAsync();
            }
            await using(var tx=await connection.BeginTransactionAsync())
            {
                await using var set=new NpgsqlCommand("SELECT set_config('mlp.actor_proof',@proof,true)",connection,tx);set.Parameters.AddWithValue("proof",token);await set.ExecuteScalarAsync();
                await using var query=new NpgsqlCommand("SELECT auth_app.has_global_access()",connection,tx);Assert.False((bool)(await query.ExecuteScalarAsync())!);
                await tx.RollbackAsync();
            }
        }
        await using(var reused=new NpgsqlConnection(settings.ConnectionString))
        {
            await reused.OpenAsync(); Assert.Equal(pid,reused.ProcessID);
            await using var query=new NpgsqlCommand("SELECT auth_app.has_global_access()",reused);Assert.False((bool)(await query.ExecuteScalarAsync())!);
        }
        NpgsqlConnection.ClearPool(new NpgsqlConnection(settings.ConnectionString));
    }

    [PostgresFact]
    public async Task UnsignedPersonCreationHintsCannotExposeForeignPerson()
    {
        var root=await AccountAsync();using var global=root.Client;
        var own=await BranchAsync(global);var foreign=await BranchAsync(global);var target=await PersonAsync(global,foreign.Id);
        var account=await AccountAsync(own.Id,root.UserId);using var restricted=account.Client;
        await using var scope=factory.Services.CreateAsyncScope();scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(account.UserId);
        await using var connection=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE")); await connection.OpenAsync();
        await using var tx=await connection.BeginTransactionAsync();
        await scope.ServiceProvider.GetRequiredService<ActorTransactionContext>().InstallAsync(connection,tx,false,CancellationToken.None);
        await using var set=new NpgsqlCommand("SELECT set_config('mlp.new_person_id',@person,true),set_config('mlp.write_branch_id',@branch,true)",connection,tx);
        set.Parameters.AddWithValue("person",target.Id.ToString());set.Parameters.AddWithValue("branch",own.Id.ToString());await set.ExecuteNonQueryAsync();
        await using var query=new NpgsqlCommand("SELECT count(*) FROM iglesia.persona WHERE id=@person",connection,tx);query.Parameters.AddWithValue("person",target.Id);
        Assert.Equal(0L,await query.ExecuteScalarAsync());await tx.RollbackAsync();
    }

    [PostgresFact]
    public async Task BranchActorCannotRevokeSessionsOfLinkedGlobalAccount()
    {
        var root=await AccountAsync(); using var global=root.Client;
        var branch=await BranchAsync(global); var person=await PersonAsync(global,branch.Id);
        await using var scope=factory.Services.CreateAsyncScope();
        var manager=scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<MisionLiderParis.Infrastructure.Identity.ApplicationUser>>();
        var user=(await manager.FindByIdAsync(root.UserId.ToString()))!;
        user.PersonId=person.Id;
        Assert.True((await manager.UpdateAsync(user)).Succeeded);
        var admin=await AccountAsync(branch.Id,root.UserId); using var restricted=admin.Client;
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(admin.UserId);
        await using var connection=new NpgsqlConnection(Environment.GetEnvironmentVariable("MLP_TEST_DATABASE"));
        await connection.OpenAsync(); await using var tx=await connection.BeginTransactionAsync();
        await scope.ServiceProvider.GetRequiredService<ActorTransactionContext>().InstallAsync(connection,tx,false,CancellationToken.None);
        await using var revoke=new NpgsqlCommand("SELECT auth_app.revoke_person_sessions(@person)",connection,tx);
        revoke.Parameters.AddWithValue("person",person.Id);
        Assert.Equal("42501",(await Assert.ThrowsAsync<PostgresException>(()=>revoke.ExecuteNonQueryAsync())).SqlState);
        await tx.RollbackAsync();
        Assert.Equal(user.SecurityStamp,(await manager.FindByIdAsync(root.UserId.ToString()))!.SecurityStamp);
    }
}
