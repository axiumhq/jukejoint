# PC B: joins the session PC A hosts, by its join code, through our signaling.
param(
    [Parameter(Mandatory = $true)][string]$Origin,
    [Parameter(Mandatory = $true)][string]$Codigo,
    [string]$UiRelay = '',
    [string]$StateDir = '',
    [switch]$SemJogo
)
. (Join-Path $PSScriptRoot 'comum.ps1')
Use-StateDir $StateDir

Start-OurDaemon $Origin
$extra = @()
if ($SemJogo) { $extra += '--no-game' }
& $Modlock join $Codigo @(UiArgs $UiRelay) @extra
