# Gives our local signaling server a temporary public https address through a
# Cloudflare quick tunnel (no account, no router changes), so a friend's PC on
# another network can reach it. Run servidor.ps1 first, in another terminal.
param(
    [int]$Port = 8080
)
. (Join-Path $PSScriptRoot 'comum.ps1')

# Pinned cloudflared release and the SHA-256 GitHub published for it.
$version = '2026.10.1'
$expected = '4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6'
$dir = Join-Path $Repo "tools\cloudflared-$version"
$exe = Join-Path $dir 'cloudflared.exe'

# Download once, refusing a file whose hash does not match.
if (-not (Test-Path $exe)) {
    New-Item -ItemType Directory -Force $dir | Out-Null
    $part = "$exe.part"
    Write-Host "Baixando cloudflared $version..."
    Invoke-WebRequest -UseBasicParsing -OutFile $part -Uri "https://github.com/cloudflare/cloudflared/releases/download/$version/cloudflared-windows-amd64.exe"
    $actual = (Get-FileHash -Algorithm SHA256 $part).Hash.ToLower()
    if ($actual -ne $expected) {
        Remove-Item $part -Force
        throw "Hash do cloudflared nao confere: esperado $expected, obtido $actual"
    }
    Move-Item -Force $part $exe
}

# The quick tunnel prints its https address in the log below; that address is
# the -Origin both PCs use. It changes every time this script starts.
Write-Host ''
Write-Host 'Procure abaixo a linha com https://....trycloudflare.com'
Write-Host 'Esse endereco e o -Origin do hospedar.ps1 e o que voce manda para o amigo.'
Write-Host 'Ctrl+C encerra o tunel.'
Write-Host ''
& $exe tunnel --no-autoupdate --url "http://127.0.0.1:$Port"
