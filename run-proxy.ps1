# Starts the ASP.NET Core proxy on http://localhost:5080
param()

$ErrorActionPreference = 'Stop'

$proj = Join-Path $PSScriptRoot 'proxy-aspnet\proxy-aspnet.csproj'

Write-Host "Starting proxy: $proj" -ForegroundColor Cyan

& dotnet run --project "$proj"
