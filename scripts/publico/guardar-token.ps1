# Saves the tunnel token the domain owner sent you, so ligar.ps1 can run the
# tunnel. The token is typed here (hidden), never pasted into a chat or a
# command line, and stays in tools\cloudflared\token (tools\ is gitignored).
. (Join-Path $PSScriptRoot 'comum.ps1')

Write-Host 'Cole o token do tunel (o texto longo que comeca com "eyJ") e aperte Enter.'
Write-Host 'Ele nao aparece na tela enquanto voce cola.'
$secure = Read-Host -AsSecureString 'Token'
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Trim()
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

# Someone may paste the whole install command; keep only the token.
if ($token -match '(eyJ[A-Za-z0-9_\-=]+)') { $token = $Matches[1] }
if ($token -notmatch '^eyJ[A-Za-z0-9_\-=]{40,}$') {
    throw 'Isso nao parece um token de tunel da Cloudflare (comeca com "eyJ" e e bem longo). Nada foi salvo.'
}

New-Item -ItemType Directory -Force $TunnelDir | Out-Null
Set-Content -Encoding ascii -NoNewline -Path $TunnelTokenFile -Value $token
Write-Host "Token salvo em $TunnelTokenFile (fora do git)."
Write-Host 'Agora: powershell -ExecutionPolicy Bypass -File scripts\publico\ligar.ps1'
