using System.Text;

namespace SpendingTracker.Api.Authentication;

public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public string Issuer { get; init; } = string.Empty;
    public string Audience { get; init; } = string.Empty;
    public string SigningKey { get; init; } = string.Empty;
    public int TokenLifetimeMinutes { get; init; } = 480;
    public IReadOnlyList<AuthUserOptions> Users { get; init; } = [];
}

public sealed class AuthUserOptions
{
    public string Username { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string Role { get; init; } = AuthRoles.Reader;
}

public static class AuthRoles
{
    public const string Reader = "Reader";
    public const string Writer = "Writer";
    public const string Admin = "Admin";
}

public static class AuthPolicies
{
    public const string ApiWriter = "ApiWriter";
}

public static class AuthOptionsValidator
{
    public static void Validate(AuthOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        if (string.IsNullOrWhiteSpace(options.Issuer))
        {
            throw new InvalidOperationException("Auth:Issuer must be configured.");
        }

        if (string.IsNullOrWhiteSpace(options.Audience))
        {
            throw new InvalidOperationException("Auth:Audience must be configured.");
        }

        if (Encoding.UTF8.GetByteCount(options.SigningKey) < 32)
        {
            throw new InvalidOperationException("Auth:SigningKey must be at least 32 bytes long.");
        }

        if (options.TokenLifetimeMinutes <= 0)
        {
            throw new InvalidOperationException("Auth:TokenLifetimeMinutes must be greater than zero.");
        }

        if (options.Users.Count == 0)
        {
            throw new InvalidOperationException("Auth:Users must contain at least one API user.");
        }

        var usernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var user in options.Users)
        {
            if (string.IsNullOrWhiteSpace(user.Username))
            {
                throw new InvalidOperationException("Each Auth:Users entry must include a username.");
            }

            if (string.IsNullOrWhiteSpace(user.Password))
            {
                throw new InvalidOperationException($"Auth user '{user.Username}' must include a password.");
            }

            if (!usernames.Add(user.Username))
            {
                throw new InvalidOperationException($"Duplicate Auth user '{user.Username}' is not allowed.");
            }

            if (user.Role is not AuthRoles.Reader and not AuthRoles.Writer and not AuthRoles.Admin)
            {
                throw new InvalidOperationException($"Auth user '{user.Username}' has unsupported role '{user.Role}'.");
            }
        }
    }
}