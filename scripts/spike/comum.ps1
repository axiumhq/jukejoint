# Shared helpers for the two-PC spike scripts. Dot-source this file.
$ErrorActionPreference = 'Stop'

$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Modlock = Join-Path $Repo 'tools\modlock-v0.1.73\modlock.exe'
$Signal = Join-Path $Repo 'tools\signal.exe'
$env:MODLOCK_NO_UPDATE_CHECK = '1'

if (-not (Test-Path $Modlock)) {
    throw "modlock.exe nao encontrado. Rode scripts\install-modlock.ps1 primeiro."
}

# Use-StateDir points this process (and the modlock commands it runs) at a
# separate daemon state folder, as when the default one holds a stuck socket.
function Use-StateDir([string]$StateDir) {
    if ($StateDir) {
        New-Item -ItemType Directory -Force $StateDir | Out-Null
        $env:APPDATA = $StateDir
    }
}

# Get-Daemons lists the running modlock daemon processes with their command lines.
function Get-Daemons {
    Get-CimInstance Win32_Process -Filter "Name='modlock.exe'" |
        Where-Object { $_.CommandLine -match ' daemon( |$)' }
}

# Test-DaemonRunning reports whether a daemon serves this state folder: a live
# daemon holds daemon.lock locked for its whole life.
function Test-DaemonRunning {
    $lock = Join-Path $env:APPDATA 'modlock\state\daemon.lock'
    if (-not (Test-Path -LiteralPath $lock)) { return $false }
    try {
        $fs = [System.IO.File]::Open($lock, 'Open', 'ReadWrite', 'ReadWrite')
    } catch {
        return $true
    }
    try {
        $fs.Lock(0, 1)
        $fs.Unlock(0, 1)
        return $false
    } catch {
        return $true
    } finally {
        $fs.Dispose()
    }
}

# Start-OurDaemon makes sure the daemon for this state folder signals at
# $Origin. A daemon on another origin (hyperline.gg) is stopped first, always
# through `daemon stop`: killing one leaves a socket Windows won't free. Only
# `status`/`stop` against a running daemon are safe; with none running,
# `status` would start one pointed at hyperline.gg.
function Start-OurDaemon([string]$Origin) {
    $state = Join-Path $env:APPDATA 'modlock\state'
    $sock = Join-Path $state 'modlock.sock'

    if (Test-DaemonRunning) {
        $status = (& $Modlock daemon status | Out-String)
        if ($status -match [regex]::Escape($Origin)) {
            Write-Host "Daemon ja roda com a nossa origem ($Origin)."
            return
        }
        Write-Host 'Parando o daemon que aponta para outra origem...'
        & $Modlock daemon stop | Out-Host
        for ($i = 0; $i -lt 20 -and (Test-DaemonRunning); $i++) { Start-Sleep -Milliseconds 250 }
    }
    if (Test-Path -LiteralPath $sock) {
        throw "Ha um modlock.sock travado em $state (daemon encerrado a forca). Reinicie o PC ou rode o script com -StateDir C:\Users\$env:USERNAME\.mlA"
    }

    # Keep the daemon's own log beside its state; a daemon started by hand
    # writes it to stderr, not to daemon.log. cmd does the redirection, because
    # Start-Process with -Redirect* hands the daemon this shell's handles and
    # the script would wait for the daemon's whole life. (Don't launch through
    # WMI: antivirus treats Win32_Process.Create as suspicious and quarantines.)
    Write-Host "Subindo o daemon com --origin $Origin ..."
    New-Item -ItemType Directory -Force $state | Out-Null
    $log = Join-Path $state 'daemon-origem.log'
    $line = "/c `"`"$Modlock`" daemon --origin $Origin --idle 60m > `"$log`" 2>&1`""
    Start-Process -FilePath $env:ComSpec -ArgumentList $line -WindowStyle Hidden -WorkingDirectory $Repo
    Write-Host "Log do daemon: $log"
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        if ((Test-DaemonRunning) -and (Test-Path -LiteralPath $sock)) {
            & $Modlock daemon status | Out-Host
            return
        }
    }
    throw "O daemon nao ficou pronto. Veja $state\daemon.log"
}

# UiArgs returns the interface flags: our https bridge when given, else none.
function UiArgs([string]$UiRelay) {
    if ($UiRelay) { return @('--ui-relay', $UiRelay) }
    return @('--ui-port', '0')
}
