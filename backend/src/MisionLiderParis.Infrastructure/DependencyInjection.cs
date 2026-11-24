using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MisionLiderParis.Application.Access;
using MisionLiderParis.Application.Auth;
using MisionLiderParis.Application.Users;
using MisionLiderParis.Infrastructure.Access;
using MisionLiderParis.Infrastructure.Configuration;
using MisionLiderParis.Infrastructure.Email;
using MisionLiderParis.Infrastructure.Identity;
using MisionLiderParis.Infrastructure.Users;
using MisionLiderParis.Infrastructure.Ministry;
using MisionLiderParis.Application.Ministry;
using MisionLiderParis.Infrastructure.Diagnostics;

namespace MisionLiderParis.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<NpgsqlPerformanceListener>();
        services.AddSingleton<PerformanceConnectionInterceptor>();
        services.AddSingleton<PerformanceTransactionInterceptor>();
        services.Configure<DatabaseOptions>(configuration.GetSection(DatabaseOptions.Section));
        services.AddScoped<MisionLiderParis.Application.Health.IDatabaseConnectivityProbe,
            MisionLiderParis.Infrastructure.Database.NpgsqlConnectivityProbe>();
        services.AddOptions<ActorProofOptions>().Bind(configuration.GetSection(ActorProofOptions.Section))
            .Validate(value => string.IsNullOrWhiteSpace(configuration["Database:ConnectionString"]) || ActorProof.IsConfigured(value),
                "A valid private actor signing key and key identifier are required.").ValidateOnStart();
        services.AddOptions<SecurityOptions>().Bind(configuration.GetSection(SecurityOptions.Section))
            .Validate(x => x.PasswordLength is >= 12 and <= 128 && x.CookieMinutes is >= 5 and <= 480 &&
                x.ResetTokenMinutes is >= 5 and <= 120 && x.MaxFailedAccessAttempts is >= 1 and <= 20 &&
                x.LockoutMinutes is >= 1 and <= 1440, "Security limits are invalid.").ValidateOnStart();
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.Section));
        services.Configure<ResendOptions>(configuration.GetSection("Resend"));
        services.Configure<GoogleGmailOptions>(configuration.GetSection("GoogleGmail"));
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<GmailOAuthState>();
        services.AddSingleton<IGmailCredentialStore,ProtectedGmailCredentialStore>();
        services.AddSingleton<GmailAccessTokens>();
        services.AddHttpClient("GoogleGmail",client=>client.Timeout=TimeSpan.FromSeconds(15))
            .ConfigurePrimaryHttpMessageHandler(()=>new HttpClientHandler {AllowAutoRedirect=false}).RemoveAllLoggers();
        services.AddScoped(provider=>new GoogleGmailClient(provider.GetRequiredService<IHttpClientFactory>().CreateClient("GoogleGmail"),
            provider.GetRequiredService<IOptions<GoogleGmailOptions>>()));
        services.AddScoped<GmailApiAccountEmailSender>();
        services.AddOptions<InvitationTokenOptions>().Configure<IOptions<EmailOptions>>((value, email) => {
            value.Name = "MLP.Invitation";
            value.TokenLifespan = TimeSpan.FromMinutes(email.Value.InvitationMinutes);
        }).Validate(value => value.TokenLifespan.TotalMinutes is >= 5 and <= 10080, "Invitation expiration is invalid.");
        services.AddDbContext<AuthDbContext>((provider, options) =>
        {
            var settings = provider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            if (!string.IsNullOrWhiteSpace(settings.ConnectionString) && string.IsNullOrWhiteSpace(settings.IdentityConnectionString))
                throw new InvalidOperationException("A separate Database:IdentityConnectionString is required.");
            if (!string.IsNullOrWhiteSpace(settings.ConnectionString) && !string.IsNullOrWhiteSpace(settings.IdentityConnectionString) &&
                new Npgsql.NpgsqlConnectionStringBuilder(settings.ConnectionString).Username == new Npgsql.NpgsqlConnectionStringBuilder(settings.IdentityConnectionString).Username)
                throw new InvalidOperationException("Identity and ministry must use different database identities.");
            if (!string.IsNullOrWhiteSpace(settings.IdentityConnectionString) && settings.RequireVerifiedTls &&
                new Npgsql.NpgsqlConnectionStringBuilder(settings.IdentityConnectionString).SslMode != Npgsql.SslMode.VerifyFull)
                throw new InvalidOperationException("Identity database TLS requires VerifyFull.");
            options.UseNpgsql(settings.RuntimeIdentityConnectionString(), postgres =>
                postgres.MigrationsHistoryTable("__ef_migrations_history", "auth_app"));
            options.EnableSensitiveDataLogging(false);
            options.AddInterceptors(provider.GetRequiredService<PerformanceConnectionInterceptor>(), provider.GetRequiredService<PerformanceTransactionInterceptor>());
            options.EnableDetailedErrors(false);
        });
        services.AddScoped<ActorContext>();
        services.AddScoped<ActorProof>();
        services.AddScoped<ActorTransactionContext>();
        services.AddScoped<ActorTransactionInterceptor>();
        services.AddScoped<ActorCommandInterceptor>();
        services.AddDbContext<MinistryDbContext>((provider, options) =>
        {
            var value=provider.GetRequiredService<IOptions<DatabaseOptions>>().Value.ConnectionString;
            if (!string.IsNullOrWhiteSpace(value))
            {
                var settings=new Npgsql.NpgsqlConnectionStringBuilder(value);
                if (settings.NoResetOnClose || settings.Multiplexing)
                    throw new InvalidOperationException("Signed context requires connection reset and no multiplexing.");
            }
            options.UseNpgsql(value)
                .AddInterceptors(provider.GetRequiredService<ActorTransactionInterceptor>(),provider.GetRequiredService<ActorCommandInterceptor>(),provider.GetRequiredService<PerformanceConnectionInterceptor>(),provider.GetRequiredService<PerformanceTransactionInterceptor>())
                .EnableSensitiveDataLogging(false).EnableDetailedErrors(false);
        });
        var security = configuration.GetSection(SecurityOptions.Section).Get<SecurityOptions>() ?? new();
        services.AddIdentityCore<ApplicationUser>(identity =>
        {
            identity.User.RequireUniqueEmail = true;
            identity.Password.RequiredLength = security.PasswordLength;
            identity.Password.RequireDigit = true;
            identity.Password.RequireLowercase = true;
            identity.Password.RequireUppercase = true;
            identity.Password.RequireNonAlphanumeric = true;
            identity.Lockout.AllowedForNewUsers = true;
            identity.Lockout.MaxFailedAccessAttempts = security.MaxFailedAccessAttempts;
            identity.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(security.LockoutMinutes);
            identity.SignIn.RequireConfirmedEmail = security.RequireConfirmedEmail;
        }).AddEntityFrameworkStores<AuthDbContext>().AddSignInManager().AddDefaultTokenProviders()
            .AddTokenProvider<InvitationTokenProvider<ApplicationUser>>(AccountInvitations.Provider);
        services.Configure<DataProtectionTokenProviderOptions>(options =>
            options.TokenLifespan = TimeSpan.FromMinutes(security.ResetTokenMinutes));
        services.AddScoped<IMinistryDirectory, MinistryDirectory>();
        services.AddScoped<AccountAccessValidator>();
        services.AddScoped<IAccessService, AccessService>();
        services.AddScoped<IUserAdministration, UserAdministration>();
        services.AddScoped<AccountEmailComposer>();
        services.AddScoped<SmtpAccountEmailSender>();
        services.AddHttpClient<ResendAccountEmailSender>(client => client.Timeout = TimeSpan.FromSeconds(15))
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler {AllowAutoRedirect = false})
            .RemoveAllLoggers();
        services.AddScoped<IAccountEmailSender>(provider => provider.GetRequiredService<IOptions<EmailOptions>>().Value.Provider switch {
            "Smtp" => provider.GetRequiredService<SmtpAccountEmailSender>(),
            "Resend" => provider.GetRequiredService<ResendAccountEmailSender>(),
            "GmailApi" => provider.GetRequiredService<GmailApiAccountEmailSender>(),
            _ => throw AccountEmailComposer.Unavailable()
        });
        services.AddScoped<AccountInvitations>();
        services.AddScoped<IInvitationActivation>(provider => provider.GetRequiredService<AccountInvitations>());
        services.AddScoped<MinistryAuthorization>();
        services.AddScoped<IBranchService, BranchService>();
        services.AddScoped<IPeopleService, PeopleService>();
        services.AddScoped<IProcessCatalogService, ProcessCatalogService>();
        services.AddScoped<IAssignmentService, AssignmentService>();
        services.AddScoped<IReportService, ReportService>();
        return services;
    }
}
