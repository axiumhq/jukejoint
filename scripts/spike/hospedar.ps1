# PC A: hosts the test mod through our signaling and prints the join code.
param(
    [Parameter(Mandatory = $true)][string]$Origin,
    [string]$Mod = '',
    [string]$UiRelay = '',
    [string]$StateDir = '',
    [switch]$SemJogo
)
. (Join-Path $PSScriptRoot 'comum.ps1')
Use-StateDir $StateDir
if (-not $Mod) { $Mod = Join-Path $Repo 'spike\mods\hello' }

Start-OurDaemon $Origin

# Host by join code only: no lobby, so nothing goes to hyperline.gg.
Write-Host ''
Write-Host 'Hospedando. Passe o codigo de entrada para o outro PC.'
Push-Location $Mod
try {
    $extra = @()
    if ($SemJogo) { $extra += '--no-game' }
    & $Modlock host --no-lobby @(UiArgs $UiRelay) @extra
} finally {
    Pop-Location
}
