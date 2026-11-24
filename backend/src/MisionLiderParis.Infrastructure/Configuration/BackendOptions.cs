namespace MisionLiderParis.Infrastructure.Configuration;

public sealed class DatabaseOptions
{
    public const string Section = "Database";
    public string ConnectionString { get; set; } = "";
    public string IdentityConnectionString { get; set; } = "";
    public bool RequireVerifiedTls { get; set; } = true;
    // Explicit runtime opt-in; never changes stored secrets or the database role.
    public bool IdentityPoolingEnabled { get; set; }
    public int IdentityPoolMaximumSize { get; set; } = 10;
    public string RuntimeIdentityConnectionString()
    {
        if (!IdentityPoolingEnabled || string.IsNullOrWhiteSpace(IdentityConnectionString)) return IdentityConnectionString;
        if (IdentityPoolMaximumSize is < 1 or > 20) throw new InvalidOperationException("Identity runtime pool must contain between 1 and 20 connections.");
        var connection = new Npgsql.NpgsqlConnectionStringBuilder(IdentityConnectionString);
        if (connection.NoResetOnClose || connection.Multiplexing)
            throw new InvalidOperationException("Identity runtime pooling requires connection reset and no multiplexing.");
        connection.Pooling = true;
        connection.MaxPoolSize = IdentityPoolMaximumSize;
        connection.MinPoolSize = 0;
        return connection.ConnectionString;
    }
}

public sealed class ActorProofOptions
{
    public const string Section = "DatabaseActor";
    public string KeyId { get; set; } = "";
    public string SigningKeyBase64 { get; set; } = "";
}

public sealed class SecurityOptions
{
    public const string Section = "Security";
    public string[] AllowedOrigins { get; set; } = [];
    public bool RequireConfirmedEmail { get; set; } = true;
    public int PasswordLength { get; set; } = 12;
    public int CookieMinutes { get; set; } = 30;
    public int ResetTokenMinutes { get; set; } = 30;
    public int MaxFailedAccessAttempts { get; set; } = 5;
    public int LockoutMinutes { get; set; } = 15;
    public string KeyRingPath { get; set; } = "";
    public string KeyCertificatePath { get; set; } = "";
    public string KeyCertificatePassword { get; set; } = "";
}

public sealed class EmailOptions
{
    public const string Section = "Email";
    public string Host { get; set; } = "";
    public string Provider { get; set; } = "Smtp";
    public string InvitationUrl { get; set; } = "";
    public string ReplyTo { get; set; } = "";
    public int InvitationMinutes { get; set; } = 1440;
    public int Port { get; set; } = 587;
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string From { get; set; } = "";
    public string RecoveryUrl { get; set; } = "";
    public string ConfirmationUrl { get; set; } = "";
}

public sealed class ResendOptions
{
    public string ApiKey { get; set; } = "";
}

public sealed class GoogleGmailOptions
{
    public const string Sender = "iglesiamisionliderparis@gmail.com";
    public const string Scope = "https://www.googleapis.com/auth/gmail.send";
    public const string CallbackPath = "/api/v1/integrations/google/callback";
    public string ClientId { get; set; } = "";
    public string ClientSecret { get; set; } = "";
    public string RedirectUri { get; set; } = "https://localhost:7243" + CallbackPath;
    // Optional import from a secret manager, never a response or a versioned credential.
    public string RefreshToken { get; set; } = "";
    public string TokenStorePath { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "MisionLiderParis", "gmail", "credential.bin");
}
