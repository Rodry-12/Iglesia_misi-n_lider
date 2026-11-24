using System.Security.AccessControl;
using System.Security.Principal;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using MisionLiderParis.Infrastructure.Configuration;

namespace MisionLiderParis.Infrastructure.Email;

public sealed class GmailCredential
{
    public string ClientId { get; set; } = "";
    public string RefreshToken { get; set; } = "";
    public bool Revoked { get; set; }
}
public interface IGmailCredentialStore
{
    Task<GmailCredential?> LoadAsync(CancellationToken ct);
    Task SaveAsync(GmailCredential credential, CancellationToken ct);
}
public sealed class ProtectedGmailCredentialStore(IOptions<GoogleGmailOptions> options, IDataProtectionProvider protection,
    IHostEnvironment environment) : IGmailCredentialStore
{
    private readonly IDataProtector protector = protection.CreateProtector("MLP.GoogleGmail.RefreshToken.v1");
    private readonly SemaphoreSlim gate = new(1,1);
    public async Task<GmailCredential?> LoadAsync(CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        try
        {
            var path = ValidatedPath();
            if (!File.Exists(path)) return null;
            RestrictFile(path);
            return JsonSerializer.Deserialize<GmailCredential>(protector.Unprotect(await File.ReadAllTextAsync(path, ct)))
                ?? throw AccountEmailComposer.Unavailable();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or System.Security.Cryptography.CryptographicException or JsonException)
        {throw AccountEmailComposer.Unavailable();}
        finally {gate.Release();}
    }
    public async Task SaveAsync(GmailCredential credential, CancellationToken ct)
    {
        await gate.WaitAsync(ct);
        string? temporary = null;
        try
        {
            var path = ValidatedPath(); var directory = Path.GetDirectoryName(path)!;
            Directory.CreateDirectory(directory); RestrictDirectory(directory);
            temporary = Path.Combine(directory, ".credential-" + Guid.NewGuid().ToString("N"));
            // Parent directory is private before creation; the payload on disk is always encrypted.
            await File.WriteAllTextAsync(temporary, protector.Protect(JsonSerializer.Serialize(credential)), ct);
            RestrictFile(temporary); File.Move(temporary,path,true); temporary = null;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or System.Security.Cryptography.CryptographicException)
        {throw AccountEmailComposer.Unavailable();}
        finally {try {if (temporary is not null) File.Delete(temporary);} finally {gate.Release();}}
    }
    private string ValidatedPath()
    {
        var configured = options.Value.TokenStorePath;
        if (string.IsNullOrWhiteSpace(configured) || !Path.IsPathFullyQualified(configured)) throw AccountEmailComposer.Unavailable();
        var path = Path.GetFullPath(configured);
        var comparison = OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
        bool Under(string parent) => path.StartsWith(Path.TrimEndingDirectorySeparator(Path.GetFullPath(parent))+Path.DirectorySeparatorChar,comparison);
        var profile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (string.IsNullOrWhiteSpace(profile) || !Under(profile) || Under(environment.ContentRootPath)) throw AccountEmailComposer.Unavailable();
        // Never allow the repository even when ContentRootPath points at its nested API folder.
        for (var directory = new DirectoryInfo(environment.ContentRootPath); directory is not null; directory = directory.Parent)
            if ((Directory.Exists(Path.Combine(directory.FullName,".git")) ||
                Directory.Exists(Path.Combine(directory.FullName,"backend")) && Directory.Exists(Path.Combine(directory.FullName,"frontend"))) && Under(directory.FullName))
                throw AccountEmailComposer.Unavailable();
        for (var directory = new DirectoryInfo(Path.GetDirectoryName(path)!); directory is not null; directory = directory.Parent)
            if (directory.Exists && (directory.Attributes & FileAttributes.ReparsePoint) != 0) throw AccountEmailComposer.Unavailable();
        if (File.Exists(path) && (File.GetAttributes(path)&FileAttributes.ReparsePoint)!=0) throw AccountEmailComposer.Unavailable();
        return path;
    }
    private static void RestrictDirectory(string path)
    {
        if (!OperatingSystem.IsWindows()) {File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite|UnixFileMode.UserExecute);return;}
        using var identity = WindowsIdentity.GetCurrent(); var acl = new DirectorySecurity(); acl.SetAccessRuleProtection(true,false);
        acl.AddAccessRule(new FileSystemAccessRule(identity.User!,FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
        new DirectoryInfo(path).SetAccessControl(acl);
    }
    private static void RestrictFile(string path)
    {
        if (!OperatingSystem.IsWindows()) {File.SetUnixFileMode(path,UnixFileMode.UserRead|UnixFileMode.UserWrite);return;}
        using var identity = WindowsIdentity.GetCurrent(); var acl = new FileSecurity(); acl.SetAccessRuleProtection(true,false);
        acl.AddAccessRule(new FileSystemAccessRule(identity.User!,FileSystemRights.FullControl,AccessControlType.Allow));
        new FileInfo(path).SetAccessControl(acl);
    }
}
