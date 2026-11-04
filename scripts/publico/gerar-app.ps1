# Builds the app for the friend test with the public addresses baked in, and
# zips it: desktop\out\Jukejoint.zip. The same zip works for you and the friend.
param(
    [string]$Domain = 'jukejoint.app'
)
. (Join-Path $PSScriptRoot 'comum.ps1')
$h = Get-Hosts $Domain

$cargo = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path $cargo) { $env:PATH = "$cargo;$env:PATH" }

$env:APP_API_URL = "https://$($h.Api)"
$env:APP_ENGINE_ORIGIN = "https://$($h.Signal)"
Remove-Item Env:APP_SITE_URL -ErrorAction SilentlyContinue

Push-Location (Join-Path $Repo 'desktop')
try {
    & npm run build:live
    if ($LASTEXITCODE -ne 0) { throw 'O build do app falhou.' }
} finally {
    Pop-Location
}
