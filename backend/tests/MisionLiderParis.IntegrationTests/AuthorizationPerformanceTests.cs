using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Application.Common;
using MisionLiderParis.Infrastructure.Ministry;

namespace MisionLiderParis.IntegrationTests;

public sealed partial class PostgresMinistryTests
{
    [PostgresFact]
    public async Task MinisterialHttpReadSharesOneTransactionForPermissionsAndRows()
    {
        var root = await AccountAsync(); using var client = root.Client;
        using (var observations = new ResolutionObservations(null))
        {
            await ExpectAsync(await client.GetAsync("/api/v1/branches?page=1&pageSize=10"), System.Net.HttpStatusCode.OK);
            Assert.Equal(1, observations.Transactions);
        }
        // A following request must obtain its own fresh signed scope.
        using (var observations = new ResolutionObservations(null))
        {
            await ExpectAsync(await client.GetAsync("/api/v1/process-assignments/participants?page=1&pageSize=10"), System.Net.HttpStatusCode.OK);
            Assert.Equal(1, observations.Transactions);
        }
        foreach (var route in new[] { "/api/v1/users?page=1&pageSize=10", "/api/v1/users/administration-options?operation=USER_VIEW" })
        {
            using var observations = new ResolutionObservations(null);
            await ExpectAsync(await client.GetAsync(route), System.Net.HttpStatusCode.OK);
            Assert.Equal(1, observations.Transactions);
        }
    }
    [PostgresFact]
    public async Task GlobalGrantResolutionUsesOneReadOnlyTransactionAndTwoQueries()
    {
        var root = await AccountAsync(); using var client = root.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        using var observations = new ResolutionObservations(db);
        var resolved = await scope.ServiceProvider.GetRequiredService<IMinistryDirectory>().ResolveAsync(
            [new(TestCatalog.GlobalRoleId, null, [])], CancellationToken.None);

        Assert.Single(resolved);
        Assert.Equal("SUPER_ADMIN", resolved[0].RoleCode);
        Assert.Equal(1, observations.Transactions);
        Assert.Equal(2, observations.Commands);
        Assert.Null(db.Database.CurrentTransaction);
    }

    [PostgresFact]
    public async Task GrantResolutionPreservesCallerTransactionAndCleansUpAfterFailure()
    {
        var root = await AccountAsync(); using var client = root.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        var directory = scope.ServiceProvider.GetRequiredService<IMinistryDirectory>();
        await using (var transaction = await db.Database.BeginTransactionAsync())
        {
            await directory.ResolveAsync([new(TestCatalog.GlobalRoleId, null, [])], CancellationToken.None);
            Assert.Same(transaction, db.Database.CurrentTransaction);
            await transaction.RollbackAsync();
        }
        await Assert.ThrowsAsync<MisionLiderParis.Application.Common.ApiException>(() =>
            directory.ResolveAsync([new(Guid.NewGuid(), null, [])], CancellationToken.None));
        Assert.Null(db.Database.CurrentTransaction);
        Assert.Equal("on", await db.Database.SqlQueryRaw<string>(
            "SELECT current_setting('transaction_read_only') AS \"Value\"").SingleAsync());
    }

    [PostgresFact]
    public async Task PaginatedReadsShareSignedTransactionWithoutCachingAuthorization()
    {
        var root = await AccountAsync(); using var client = root.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var db = services.GetRequiredService<MinistryDbContext>();
        Func<Task>[] reads = [
            async () => { await services.GetRequiredService<IBranchService>().ListAsync(root.UserId, new ListQuery(), default); },
            async () => { await services.GetRequiredService<IPeopleService>().ListAsync(root.UserId, new PersonQuery(), default); },
            async () => { await services.GetRequiredService<IProcessCatalogService>().CategoriesAsync(root.UserId, new ListQuery(), default); },
            async () => { await services.GetRequiredService<IProcessCatalogService>().ProcessesAsync(root.UserId, new ProcessQuery(), default); },
            async () => { await services.GetRequiredService<IAssignmentService>().ListAsync(root.UserId, new AssignmentQuery(IncludeFilters: true), default); }
        ];
        foreach (var read in reads)
        {
            using var observations = new ResolutionObservations(db);
            await read();
            Assert.Equal(2, observations.Transactions); // Fresh grants + one read-only list/filter scope.
            Assert.Null(db.Database.CurrentTransaction);
        }
        var manager = services.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<MisionLiderParis.Infrastructure.Identity.ApplicationUser>>();
        var user = (await manager.FindByIdAsync(root.UserId.ToString()))!;
        user.IsActive = false;
        Assert.True((await manager.UpdateAsync(user)).Succeeded);
        await Assert.ThrowsAsync<ApiException>(() => services.GetRequiredService<IBranchService>()
            .ListAsync(root.UserId, new ListQuery(), default));
    }

    [PostgresFact]
    public async Task GroupedReadScopeEnforcesReadOnlyAndRollsBackRejectedWrites()
    {
        var root = await AccountAsync(); using var client = root.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = scope.ServiceProvider.GetRequiredService<MinistryDbContext>();
        await using (var transaction = await scope.ServiceProvider.GetRequiredService<ActorTransactionContext>()
            .BeginReadOnlyAsync(db, default))
        {
            Assert.Equal("on", await db.Database.SqlQueryRaw<string>(
                "SELECT current_setting('transaction_read_only') AS \"Value\"").SingleAsync());
            var error = await Assert.ThrowsAsync<Npgsql.PostgresException>(() =>
                db.Database.ExecuteSqlRawAsync("UPDATE iglesia.persona SET nombres=nombres WHERE false"));
            Assert.Equal("25006", error.SqlState);
            await transaction.RollbackAsync();
        }
        Assert.Null(db.Database.CurrentTransaction);
        Assert.True(await db.Database.SqlQueryRaw<bool>("SELECT auth_app.has_global_access() AS \"Value\"").SingleAsync());
    }

    [PostgresFact]
    public async Task BranchAdministratorsShareSignedReadScopeAndPreserveCallerTransaction()
    {
        var root = await AccountAsync(); using var client = root.Client;
        var branch = await BranchAsync(client);
        var admin = await AccountAsync(branch.Id, root.UserId); using var adminClient = admin.Client;
        await using var scope = factory.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        services.GetRequiredService<ActorContext>().SetUser(root.UserId);
        var db = services.GetRequiredService<MinistryDbContext>();
        var branches = services.GetRequiredService<IBranchService>();
        using (var observations = new ResolutionObservations(db))
        {
            var page = await branches.AdministratorsAsync(root.UserId, branch.Id, 1, 25, default);
            Assert.Equal(admin.UserId, Assert.Single(page.Items).UserId);
            Assert.Equal(1, page.TotalCount);
            Assert.Equal(2, observations.Transactions); // Fresh grants + grouped branch/role reads.
            Assert.Null(db.Database.CurrentTransaction);
        }
        await Assert.ThrowsAsync<ApiException>(() =>
            branches.AdministratorsAsync(root.UserId, Guid.NewGuid(), 1, 25, default));
        Assert.Null(db.Database.CurrentTransaction);
        await using var transaction = await db.Database.BeginTransactionAsync();
        await branches.AdministratorsAsync(root.UserId, branch.Id, 1, 25, default);
        Assert.Same(transaction, db.Database.CurrentTransaction);
        await transaction.RollbackAsync();
    }

    // Counts EF events for this context only; never records SQL, parameters or credentials.
    private sealed class ResolutionObservations : IObserver<DiagnosticListener>,
        IObserver<KeyValuePair<string, object?>>, IDisposable
    {
        private readonly MinistryDbContext? database;
        private readonly List<IDisposable> subscriptions = [];
        public int Transactions { get; private set; }
        public int Commands { get; private set; }
        public ResolutionObservations(MinistryDbContext? database)
        {
            this.database = database;
            subscriptions.Add(DiagnosticListener.AllListeners.Subscribe(this));
        }
        public void OnNext(DiagnosticListener listener)
        {
            if (listener.Name == "Microsoft.EntityFrameworkCore") subscriptions.Add(listener.Subscribe(this));
        }
        public void OnNext(KeyValuePair<string, object?> item)
        {
            if (item.Key == RelationalEventId.TransactionStarted.Name &&
                item.Value is TransactionEndEventData transaction && transaction.Context is MinistryDbContext && (database is null || transaction.Context == database))
                Transactions++;
            if (item.Key == RelationalEventId.CommandExecuted.Name &&
                item.Value is CommandExecutedEventData command && command.Context is MinistryDbContext && (database is null || command.Context == database))
                Commands++;
        }
        public void OnError(Exception error) { }
        public void OnCompleted() { }
        public void Dispose() { foreach (var subscription in subscriptions) subscription.Dispose(); }
    }
}
