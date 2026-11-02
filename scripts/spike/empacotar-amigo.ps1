# Builds dist\kit-amigo.zip: only what a friend's PC needs to join a session.
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$dist = Join-Path $Repo 'dist'
$stage = Join-Path $dist 'kit-amigo'
$zip = Join-Path $dist 'kit-amigo.zip'

# Lay out the same tree the scripts expect: scripts\ and scripts\spike\.
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force (Join-Path $stage 'scripts\spike') | Out-Null
Copy-Item (Join-Path $Repo 'scripts\install-modlock.ps1') (Join-Path $stage 'scripts')
foreach ($name in 'comum.ps1', 'entrar.ps1', 'parar.ps1') {
    Copy-Item (Join-Path $Repo "scripts\spike\$name") (Join-Path $stage 'scripts\spike')
}
foreach ($name in 'ENTRAR.cmd', 'SAIR.cmd', 'LEIA-AMIGO.md') {
    Copy-Item (Join-Path $Repo "scripts\spike\amigo\$name") $stage
}

if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Write-Host "Pronto: $zip"
Get-ChildItem -Recurse $stage | ForEach-Object { $_.FullName.Substring($stage.Length + 1) }
