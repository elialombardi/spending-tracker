using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SpendingTracker.Api.Authentication;
using SpendingTracker.Api.Contracts;
using SpendingTracker.Api.Services;

namespace SpendingTracker.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(AuthOptions authOptions, AuthTokenService tokenService) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("token")]
    [ProducesResponseType(typeof(AuthTokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult<AuthTokenResponse> CreateToken([FromBody] LoginRequest request)
    {
        var user = authOptions.Users.FirstOrDefault(candidate =>
            string.Equals(candidate.Username, request.Username, StringComparison.OrdinalIgnoreCase));

        if (user is null || !string.Equals(user.Password, request.Password, StringComparison.Ordinal))
        {
            return Unauthorized();
        }

        return Ok(tokenService.CreateToken(user.Username, user.Role));
    }
}