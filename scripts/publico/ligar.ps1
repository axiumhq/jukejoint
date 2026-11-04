# Starts everything the friend test needs, on this PC:
#   the lobby API (with the Steam key from server\.data\steam-api-key),
#   the signaling server, and the Cloudflare tunnel that publishes both.
# Ctrl+C (or closing the window) stops the three. Logs go to tools\publico-logs.
#
# -SemTunel runs only the two servers, for a local check without Cloudflare.
param(
    [string]$Domain = 'jukejoint.app',
    [switch]$SemTunel
)
. (Join-Path $PSScriptRoot 'comum.ps1')
$h = Get-Hosts $Domain

$useToken = Test-Path $TunnelTokenFile
if (-not $SemTunel -and -not $useToken -and -not (Test-Path $TunnelConfig)) {
    throw "Falta o tunel. Dominio na conta de outra pessoa: scripts\publico\guardar-token.ps1 (veja scripts\publico\LEIA.md). Na sua conta: scripts\publico\configurar-tunel.ps1"
}

# The API binary is rebuilt from server\ every time (a few seconds), so it is
# never older than the code.
Use-Go
$api = Join-Path $Tools 'api-server.exe'
Write-Host 'Compilando a API...'
Push-Location (Join-Path $Repo 'server')
try {
    & go build -o $api .
    if ($LASTEXITCODE -ne 0) { throw 'A API nao compilou.' }
} finally {
    Pop-Location
}
$signal = Join-Path $Tools 'signal.exe'
if (-not (Test-Path $signal)) {
    throw "signal.exe nao encontrado em $signal. Compile spike\signal (veja o README dele)."
}

$data = Join-Path $Repo 'server\.data'
if (-not (Test-Path (Join-Path $data 'steam-api-key')) -and -not $env:STEAM_API_KEY) {
    Write-Host 'Aviso: sem server\.data\steam-api-key, as contas aparecem como "Jogador 1234" e sem amigos.'
}

$logs = Join-Path $Tools 'publico-logs'
New-Item -ItemType Directory -Force $logs | Out-Null

# Child processes inherit this environment. Only for this window.
$env:ADDR = "127.0.0.1:$ApiPort"
$env:PUBLIC_URL = if ($SemTunel) { "http://localhost:$ApiPort" } else { "https://$($h.Api)" }
$env:WEB_ORIGIN = 'http://tauri.localhost'
$env:DATA_DIR = $data
# cloudflared runs on this PC, so every tunnelled request comes from 127.0.0.1;
# its CF-Connecting-IP then tells the API who each player is.
$env:TRUSTED_PROXIES = '127.0.0.1'
Remove-Item Env:DEV_LOGIN -ErrorAction SilentlyContinue

$procs = @()
function Stop-All {
    foreach ($p in $script:procs) {
        if ($p -and -not $p.HasExited) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
    }
}

function Wait-Healthy([string]$url, [string]$what) {
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url
            if ($r.StatusCode -eq 200) { Write-Host "  ok: $what ($url)"; return $true }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    Write-Host "  FALHOU: $what nao respondeu em $url"
    return $false
}

try {
    # Start-Process (never WMI: antivirus flags Win32_Process.Create).
    $procs += Start-Process -FilePath $api -WorkingDirectory $Repo -WindowStyle Hidden -PassThru `
        -RedirectStandardError (Join-Path $logs 'api.log') -RedirectStandardOutput (Join-Path $logs 'api.out.log')
    $procs += Start-Process -FilePath $signal -WorkingDirectory $Repo -WindowStyle Hidden -PassThru `
        -ArgumentList @('-addr', "127.0.0.1:$SignalPort", '-secret-file', (Join-Path $Tools 'signal-secret.key')) `
        -RedirectStandardError (Join-Path $logs 'signal.log') -RedirectStandardOutput (Join-Path $logs 'signal.out.log')

    Write-Host 'Conferindo os servidores neste PC:'
    $ok = (Wait-Healthy "http://127.0.0.1:$ApiPort/healthz" 'API') -and (Wait-Healthy "http://127.0.0.1:$SignalPort/healthz" 'sinalizacao')
    if (-not $ok) { throw "Um servidor nao subiu. Veja os logs em $logs" }

    if ($SemTunel) {
        Write-Host ''
        Write-Host "Rodando so neste PC (sem tunel). Logs em $logs. Ctrl+C encerra."
        while ($true) {
            Start-Sleep -Seconds 2
            foreach ($p in $procs) { if ($p.HasExited) { throw "Um servidor parou. Veja os logs em $logs" } }
        }
    }

    Install-Cloudflared
    if ($useToken) {
        # Tunnel managed in the domain owner's dashboard. The token goes in the
        # environment (TUNNEL_TOKEN), never on the command line, where any
        # program could read it.
        $env:TUNNEL_TOKEN = (Get-Content -Raw $TunnelTokenFile).Trim()
        $tunnelArgs = @('tunnel', '--no-autoupdate', 'run')
    } else {
        $tunnelArgs = @('tunnel', '--config', $TunnelConfig, 'run')
    }
    $procs += Start-Process -FilePath $Cloudflared -WindowStyle Hidden -PassThru -ArgumentList $tunnelArgs `
        -RedirectStandardError (Join-Path $logs 'tunel.log') -RedirectStandardOutput (Join-Path $logs 'tunel.out.log')
    Remove-Item Env:TUNNEL_TOKEN -ErrorAction SilentlyContinue

    Write-Host 'Conferindo pelos enderecos publicos (o tunel leva alguns segundos):'
    $ok = (Wait-Healthy "https://$($h.Api)/healthz" 'API publica') -and (Wait-Healthy "https://$($h.Signal)/healthz" 'sinalizacao publica')
    if (-not $ok) { throw "O tunel nao respondeu. Veja $(Join-Path $logs 'tunel.log')" }

    Write-Host ''
    Write-Host 'Tudo no ar:'
    Write-Host "  API          https://$($h.Api)"
    Write-Host "  Sinalizacao  https://$($h.Signal)"
    Write-Host "Logs em $logs. Deixe esta janela aberta durante o teste. Ctrl+C encerra tudo."
    while ($true) {
        Start-Sleep -Seconds 2
        foreach ($p in $procs) { if ($p.HasExited) { throw "Um processo parou ($($p.ProcessName)). Veja os logs em $logs" } }
    }
} finally {
    Stop-All
    Write-Host 'Servidores e tunel encerrados.'
}
