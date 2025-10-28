using System.Net;

var builder = WebApplication.CreateBuilder(args);

// CORS: allow any origin (suitable for a local utility proxy)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy => policy
        .SetIsOriginAllowed(_ => true)
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// HttpClient to reach TelecomSY upstream
builder.Services.AddHttpClient("telecom", c =>
{
    c.BaseAddress = new Uri("https://user.telecomsy.com/");
    c.Timeout = TimeSpan.FromSeconds(20);
});

var app = builder.Build();
app.UseCors();

app.MapGet("/api/gso", async (HttpContext http, IHttpClientFactory httpClientFactory) =>
{
    string user = http.Request.Query["userfrom_ui"].ToString();
    string pass = http.Request.Query["passfrom_ui"].ToString();

    if (string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(pass))
    {
        return Results.BadRequest(new { error = "Missing userfrom_ui or passfrom_ui" });
    }

    // Build upstream URL
    var remotePath = $"users/gso.php?userfrom_ui={Uri.EscapeDataString(user)}&passfrom_ui={Uri.EscapeDataString(pass)}";

    try
    {
        var client = httpClientFactory.CreateClient("telecom");
        using var upstream = await client.GetAsync(remotePath, HttpCompletionOption.ResponseHeadersRead, http.RequestAborted);

        var payload = await upstream.Content.ReadAsStringAsync(http.RequestAborted);
        // Forward as JSON (API tends to return JSON; if not strictly JSON, the frontend handles parse issues)
        var statusCode = (int)upstream.StatusCode;
        if (statusCode >= 400)
        {
            return Results.Problem(title: "Upstream error", detail: payload, statusCode: statusCode);
        }

        return Results.Text(payload, "application/json; charset=utf-8");
    }
    catch (TaskCanceledException ex)
    {
        return Results.Problem(title: "Timeout", detail: ex.Message, statusCode: (int)HttpStatusCode.GatewayTimeout);
    }
    catch (Exception ex)
    {
        return Results.Problem(title: "Proxy error", detail: ex.Message, statusCode: (int)HttpStatusCode.BadGateway);
    }
})
.WithName("GsoProxy")
.Produces(StatusCodes.Status200OK, contentType: "application/json")
.Produces(StatusCodes.Status400BadRequest)
.Produces(StatusCodes.Status502BadGateway)
.Produces(StatusCodes.Status504GatewayTimeout);

// Bind to a stable local URL
app.Urls.Clear();
app.Urls.Add("http://localhost:5080");

app.Run();
