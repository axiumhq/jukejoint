# Downloads the pinned Modlock CLI into tools\ and refuses it unless its SHA-256
# matches the digest GitHub published for the release asset.
$ErrorActionPreference = 'Stop'

$version = 'v0.1.73'
$expected = 'b958895b3a410b7446490318547b6aa9b654983cd7ed710a8a4d49402ad13fa7'
$url = "https://github.com/paralin/modlock/releases/download/$version/modlock-windows-amd64.exe"

$dir = Join-Path $PSScriptRoot "..\tools\modlock-$version"
$exe = Join-Path $dir 'modlock.exe'
$part = "$exe.part"
New-Item -ItemType Directory -Force $dir | Out-Null

# Download beside the target, check the hash, then move it into place.
Write-Host "Baixando modlock $version..."
Invoke-WebRequest -Uri $url -OutFile $part -UseBasicParsing
$actual = (Get-FileHash -Algorithm SHA256 $part).Hash.ToLower()
if ($actual -ne $expected) {
    Remove-Item $part -Force
    throw "Hash nao confere: esperado $expected, obtido $actual"
}
Move-Item -Force $part $exe
Write-Host "OK: $exe (sha256 $actual)"
