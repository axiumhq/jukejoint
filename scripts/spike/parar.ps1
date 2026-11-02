# Stops this PC's modlock daemon the safe way (never by killing it).
param(
    [string]$StateDir = ''
)
. (Join-Path $PSScriptRoot 'comum.ps1')
Use-StateDir $StateDir

if (Test-DaemonRunning) {
    & $Modlock daemon stop
} else {
    Write-Host 'Nenhum daemon rodando.'
}
