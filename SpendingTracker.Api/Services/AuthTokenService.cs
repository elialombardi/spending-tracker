using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using SpendingTracker.Api.Authentication;
using SpendingTracker.Api.Contracts;

namespace SpendingTracker.Api.Services;

public sealed class AuthTokenService(AuthOptions authOptions)
{
    private readonly SigningCredentials _signingCredentials = new(
        new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(authOptions.SigningKey)),
        SecurityAlgorithms.HmacSha256);

    public AuthTokenResponse CreateToken(string username, string role)
    {
        var expiresAt = DateTimeOffset.UtcNow.AddMinutes(authOptions.TokenLifetimeMinutes);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(JwtRegisteredClaimNames.UniqueName, username),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
        };

        var token = new JwtSecurityToken(
            issuer: authOptions.Issuer,
            audience: authOptions.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expiresAt.UtcDateTime,
            signingCredentials: _signingCredentials);

        return new AuthTokenResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            "Bearer",
            expiresAt,
            username,
            role);
    }
}