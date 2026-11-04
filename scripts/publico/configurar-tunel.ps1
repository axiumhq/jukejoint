# One-time setup: a Cloudflare named tunnel that publishes
#   https://api.<domain>    -> the lobby API   (127.0.0.1:8291)
#   https://signal.<domain> -> the signaling   (127.0.0.1:8080)
# with fixed addresses, https and no router changes.
#
# Before: the domain must be on your Cloudflare account (free plan is fine).
# The first run opens the browser so YOU sign in to Cloudflare and pick the
# domain; nothing here sees your password. Running it again is safe: it only
# creates what is missing and rewrites the config.
param(
    [string]$Domain = 'jukejoint.app',
    [string]$Name = 'jukejoint'
)
. (Join-Path $PSScriptRoot 'comum.ps1')
$h = Get-Hosts $Domain

Install-Cloudflared

# 1. Sign in (creates %USERPROFILE%\.cloudflared\cert.pem for this domain).
if (-not (Test-Path (Join-Path $CloudflaredHome 'cert.pem'))) {
    Write-Host ''
    Write-Host "O navegador vai abrir: entre na sua conta Cloudflare e escolha o dominio $Domain."
    & $Cloudflared tunnel login
    if ($LASTEXITCODE -ne 0) { throw 'O login na Cloudflare nao terminou.' }
}

# 2. The tunnel itself (once).
$list = (& $Cloudflared tunnel list --output json | Out-String) | ConvertFrom-Json
$tunnel = $list | Where-Object { $_.name -eq $Name } | Select-Object -First 1
if (-not $tunnel) {
    Write-Host "Criando o tunel '$Name'..."
    & $Cloudflared tunnel create $Name | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'Nao deu para criar o tunel.' }
    $list = (& $Cloudflared tunnel list --output json | Out-String) | ConvertFrom-Json
    $tunnel = $list | Where-Object { $_.name -eq $Name } | Select-Object -First 1
}
$id = $tunnel.id
$creds = Join-Path $CloudflaredHome "$id.json"
if (-not (Test-Path $creds)) {
    throw "As credenciais do tunel ($creds) nao estao neste PC. Rode o script no PC que criou o tunel, ou apague o tunel no painel da Cloudflare e rode de novo."
}

# 3. DNS: both names point at the tunnel (safe to repeat).
foreach ($name in @($h.Api, $h.Signal)) {
    Write-Host "DNS: $name -> tunel $Name"
    & $Cloudflared tunnel route dns --overwrite-dns $Name $name | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Nao deu para apontar $name para o tunel." }
}

# 4. Config: only these two names, anything else gets a 404.
New-Item -ItemType Directory -Force $TunnelDir | Out-Null
@"
tunnel: $id
credentials-file: $creds
no-autoupdate: true
ingress:
  - hostname: $($h.Api)
    service: http://127.0.0.1:$ApiPort
  - hostname: $($h.Signal)
    service: http://127.0.0.1:$SignalPort
  - service: http_status:404
"@ | Set-Content -Encoding ascii $TunnelConfig

Write-Host ''
Write-Host "Pronto. Config em $TunnelConfig"
Write-Host "Agora: powershell -ExecutionPolicy Bypass -File scripts\publico\ligar.ps1"
