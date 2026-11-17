# Downloads the pinned Modlock CLI into tools\ and refuses it unless its SHA-256
# matches the digest GitHub published for the release asset.
$ErrorActionPreference = 'Stop'

$version = 'v0.1.85'
$expected = '663245f1390a48c35bd6b41d2ce6a3a790ea475b4088631156172eebdcdec666'
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
