# Runs our signaling server so both PCs can find each other. Run it on the PC
# that hosts (PC A), or on any machine both PCs reach.
param(
    [int]$Port = 8080
)
. (Join-Path $PSScriptRoot 'comum.ps1')

if (-not (Test-Path $Signal)) {
    throw "signal.exe nao encontrado em $Signal. Compile spike\signal (veja o README)."
}

# Keep the ticket secret beside the tools so tickets survive a restart.
$secret = Join-Path $Repo 'tools\signal-secret.key'

# Show the addresses the other PC can use.
Write-Host 'Enderecos desta maquina na rede local:'
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    ForEach-Object { Write-Host "  http://$($_.IPAddress):$Port" }
Write-Host ''
Write-Host 'Se o Windows perguntar sobre o firewall, permita em redes privadas.'
Write-Host 'Ctrl+C encerra o servidor.'
Write-Host ''

& $Signal -addr "0.0.0.0:$Port" -secret-file $secret
