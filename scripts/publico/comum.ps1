# Shared settings for the public test setup (API + signaling + Cloudflare
# named tunnel on our domain). Dot-source this file.
$ErrorActionPreference = 'Stop'

$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Tools = Join-Path $Repo 'tools'

# Local ports the tunnel forwards to. Nothing listens on the network: both
# servers bind to 127.0.0.1 and only the tunnel reaches them.
$ApiPort = 8291
$SignalPort = 8080

function Get-Hosts([string]$Domain) {
    [pscustomobject]@{
        Api    = "api.$Domain"
        Signal = "signal.$Domain"
    }
}

# Pinned cloudflared release and the SHA-256 GitHub published for it (same as
# scripts\spike\tunel.ps1).
$CloudflaredVersion = '2026.10.1'
$CloudflaredSha256 = '4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6'
$Cloudflared = Join-Path $Tools "cloudflared-$CloudflaredVersion\cloudflared.exe"

# Where the tunnel config lives (tools\ is gitignored). The tunnel's own
# credentials stay where cloudflared puts them: %USERPROFILE%\.cloudflared.
$TunnelDir = Join-Path $Tools 'cloudflared'
$TunnelConfig = Join-Path $TunnelDir 'config.yml'
# Or, when the domain is on someone else's Cloudflare account: a tunnel made in
# their dashboard (hostnames set there) and only its token here.
$TunnelTokenFile = Join-Path $TunnelDir 'token'
$CloudflaredHome = Join-Path $env:USERPROFILE '.cloudflared'

function Install-Cloudflared {
    if (Test-Path $Cloudflared) { return }
    $dir = Split-Path $Cloudflared
    New-Item -ItemType Directory -Force $dir | Out-Null
    $part = "$Cloudflared.part"
    Write-Host "Baixando cloudflared $CloudflaredVersion..."
    Invoke-WebRequest -UseBasicParsing -OutFile $part -Uri "https://github.com/cloudflare/cloudflared/releases/download/$CloudflaredVersion/cloudflared-windows-amd64.exe"
    $actual = (Get-FileHash -Algorithm SHA256 $part).Hash.ToLower()
    if ($actual -ne $CloudflaredSha256) {
        Remove-Item $part -Force
        throw "Hash do cloudflared nao confere: esperado $CloudflaredSha256, obtido $actual"
    }
    Move-Item -Force $part $Cloudflared
}

# Go toolchain kept in tools\go (portable, outside git).
function Use-Go {
    $go = Join-Path $Tools 'go\bin'
    if (-not (Test-Path (Join-Path $go 'go.exe'))) {
        throw "Go nao encontrado em $go."
    }
    $env:PATH = "$go;$env:PATH"
    $env:GOTOOLCHAIN = 'local'
}
