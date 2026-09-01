<#
certutil -addstore -f "ROOT" \\SERVER\earchive-cert\rootCA.pem
#>

<#
whoami /groups | findstr /c:"S-1-5-32-544"; Get-NetIPAddress -AddressFamily IPv4 | ? {$_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*'} | ft IPAddress,InterfaceAlias,PrefixOrigin -A; Get-NetTCPConnection -State Listen | ? {$_.LocalPort -in 80,443,4500,4801} | ft LocalPort,OwningProcess -A; Get-Process nginx -EA 0 | ft Id,Path -A; Get-ChildItem C:\nginx\nginx.exe,'C:\Program Files\nginx\nginx.exe' -EA 0 | ft FullName -A; Get-ScheduledTask earchive-nginx -EA 0 | ft TaskName,State -A; Get-NetFirewallRule -DisplayName 'e-Archive HTTPS*' -EA 0 | ft DisplayName,Enabled -A; Get-SmbShare -EA 0 | ft Name,Path -A; pm2 list; (Test-NetConnection github.com -Port 443 -WarningAction 0).TcpTestSucceeded
#>

[CmdletBinding()]
param(
    [string]$ServerIp = "",
    [string]$DistPath = "",
    [int]$HttpsPort = 0,
    [switch]$NoShare,
    [switch]$SkipNginx,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$CertDir   = "C:\certs"
$ShareDir  = Join-Path $CertDir "client-setup"
$ShareName = "earchive-cert"
$NginxDir  = "C:\nginx"
$TaskName  = "earchive-nginx"

# the API port already lives in the backend's own configuration
function Get-BackendPort {
    $envPath = Join-Path $PSScriptRoot "..\e-archive\.env"
    if (Test-Path $envPath) {
        foreach ($line in (Get-Content $envPath)) {
            if ($line -match '^\s*PORT\s*=\s*(\d+)') { return [int]$Matches[1] }
        }
    }
    foreach ($p in @(4801, 3000)) {
        if (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue) { return $p }
    }
    return 4801
}

# native stderr becomes an error record under $ErrorActionPreference=Stop, which
# aborts on tools that write normal progress to stderr (mkcert, nginx, pm2)
function Invoke-Native {
    param([string]$Exe, [string[]]$Arguments = @())
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
        return [pscustomobject]@{ Output = @($output); ExitCode = $LASTEXITCODE }
    } finally { $ErrorActionPreference = $previous }
}

# pm2 prints a banner around the JSON, and its env block holds both 'username' and
# 'USERNAME' - ConvertFrom-Json is case-insensitive and rejects that as duplicate
function Get-Pm2Json {
    if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) { return $null }
    try {
        $raw = (Invoke-Native "pm2" @("jlist")).Output -join "`n"
        $start = $raw.IndexOf('[')
        $end = $raw.LastIndexOf(']')
        if ($start -lt 0 -or $end -le $start) { return $null }
        Add-Type -AssemblyName System.Web.Extensions -ErrorAction SilentlyContinue
        $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
        $ser.MaxJsonLength = [int]::MaxValue
        return $ser.DeserializeObject($raw.Substring($start, $end - $start + 1))
    } catch { return $null }
}

# the API process: running app.js, as opposed to the static file server
function Get-Pm2AppProcess {
    $list = Get-Pm2Json
    if (-not $list) { return $null }
    foreach ($proc in $list) {
        $script = [string]$proc.pm2_env.pm_exec_path
        if ($script -match 'app\.js$') { return $proc }
    }
    return $null
}

# the frontend path and port are already recorded in the running pm2 deployment
function Get-Pm2StaticServer {
    $list = Get-Pm2Json
    if (-not $list) { return $null }
    foreach ($proc in $list) {
        $procArgs = @($proc.pm2_env.args)
        if ($procArgs.Count -eq 0) { continue }
        $dir = $null; $port = 0
        foreach ($a in $procArgs) {
            $s = [string]$a
            # pm2 can include empty entries; Test-Path "" is a binding error, not a false
            if ([string]::IsNullOrWhiteSpace($s)) { continue }
            if ($s -match '^\d+$') {
                $port = [int]$s
            } else {
                $isDir = $false
                try { $isDir = (Test-Path -LiteralPath $s) -and (Test-Path -LiteralPath (Join-Path $s "index.html")) } catch { $isDir = $false }
                if ($isDir) { $dir = (Resolve-Path -LiteralPath $s).Path }
            }
        }
        if ($dir -and $port -gt 0) {
            return [pscustomobject]@{ Name = $proc.name; DistPath = $dir; Port = $port }
        }
    }
    return $null
}
$MkcertVersion = "v1.4.4"
$MkcertUrl = "https://github.com/FiloSottile/mkcert/releases/download/$MkcertVersion/mkcert-$MkcertVersion-windows-amd64.exe"
$NginxVersion = "1.26.2"
$NginxUrl = "https://nginx.org/download/nginx-$NginxVersion.zip"
$ConfigMarker = "# managed-by-earchive-setup"

function Write-Step { param($m) Write-Host "`n=== $m ===" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "  [ok]   $m" -ForegroundColor Green }
function Write-Inf  { param($m) Write-Host "  [info] $m" -ForegroundColor Gray }
function Write-Wrn  { param($m) Write-Host "  [warn] $m" -ForegroundColor Yellow }
function Write-Err  { param($m) Write-Host "  [FAIL] $m" -ForegroundColor Red }

function Get-ListenerProcess {
    param([int]$Port)
    $conn = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $conn) { return $null }
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if (-not $proc) { return [pscustomobject]@{ Pid = $conn.OwningProcess; Name = "unknown" } }
    return [pscustomobject]@{ Pid = $proc.Id; Name = $proc.ProcessName }
}

function Get-Pm2ProcessByPid {
    param([int]$ProcessId)
    $list = Get-Pm2Json
    if (-not $list) { return $null }
    return $list | Where-Object { $_.pid -eq $ProcessId } | Select-Object -First 1
}

Write-Step "Prerequisites"

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Err "Not running as administrator - reopen PowerShell with Run as administrator."
    exit 1
}
Write-Ok "Administrator rights confirmed"

try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$hasInternet = $false
try {
    $hasInternet = (Test-NetConnection -ComputerName "github.com" -Port 443 -WarningAction SilentlyContinue).TcpTestSucceeded
} catch { $hasInternet = $false }
if ($hasInternet) { Write-Ok "Internet reachable" } else { Write-Wrn "No internet - downloads will fail, manual URLs printed" }

Write-Step "Application processes"

$BackendPort = Get-BackendPort
$BackendDir = (Resolve-Path (Join-Path $PSScriptRoot "..\e-archive") -ErrorAction SilentlyContinue).Path
$hasPm2 = [bool](Get-Command pm2 -ErrorAction SilentlyContinue)
$BackendName = ""

if (-not $hasPm2) {
    Write-Wrn "pm2 not installed - the app will not be started or restarted by this script"
} else {
    $pm2App = Get-Pm2AppProcess
    if ($pm2App) {
        $BackendName = $pm2App.name
        Write-Ok "Backend running under pm2 as '$BackendName'"
    } elseif (Get-ListenerProcess -Port $BackendPort) {
        # something already serves the API - starting another would duplicate it
        $other = Get-ListenerProcess -Port $BackendPort
        Write-Wrn "Port $BackendPort already served by $($other.Name) (pid $($other.Pid)) but not visible to this pm2 daemon"
        Write-Wrn "Not starting a second instance. pm2 runs one daemon per user - if the app was"
        Write-Wrn "started by another account, run this script from that same account instead."
    } elseif ($BackendDir -and (Test-Path (Join-Path $BackendDir "app.js"))) {
        $BackendName = "e-archive"
        Write-Inf "Backend not under pm2 - starting it"
        Push-Location $BackendDir
        try {
            (Invoke-Native "pm2" @("start", "app.js", "--name", $BackendName)) | Out-Null
            Start-Sleep -Seconds 3
        } finally { Pop-Location }
        if (Get-Pm2AppProcess) { Write-Ok "Started backend as '$BackendName'" }
        else { Write-Wrn "pm2 did not start the backend - check: pm2 logs $BackendName"; $BackendName = "" }
    } else {
        Write-Wrn "app.js not found near this script - start the backend yourself"
    }
}
Write-Ok "Backend port $BackendPort"

$pm2Static = Get-Pm2StaticServer
if ($pm2Static) {
    Write-Ok "Frontend served by pm2 '$($pm2Static.Name)' on port $($pm2Static.Port)"
    if ($HttpsPort -eq 0) { $HttpsPort = $pm2Static.Port }
    if ([string]::IsNullOrWhiteSpace($DistPath)) { $DistPath = $pm2Static.DistPath }
} else {
    Write-Inf "No pm2 static server - nginx will serve the frontend"
}

if ($HttpsPort -eq 0) { $HttpsPort = 4500 }
$FirewallRule = "e-Archive HTTPS $HttpsPort"
Write-Ok "HTTPS port $HttpsPort"

Write-Step "Server address"

if ([string]::IsNullOrWhiteSpace($ServerIp)) {
    $candidates = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown"
    })
    # prefer the adapter carrying the default route
    $gated = @($candidates | Where-Object {
        Get-NetRoute -InterfaceIndex $_.InterfaceIndex -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue
    })
    if ($gated.Count -gt 0) { $candidates = $gated }

    if ($candidates.Count -eq 0) { Write-Err "No LAN IP found - re-run with -ServerIp <address>"; exit 1 }
    if ($candidates.Count -gt 1) {
        Write-Wrn "Several addresses found, using the first:"
        $candidates | ForEach-Object { Write-Host "         $($_.IPAddress)  ($($_.InterfaceAlias))" }
    }
    $ServerIp = $candidates[0].IPAddress
}

if ($ServerIp -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { Write-Err "'$ServerIp' is not a valid IPv4 address"; exit 1 }

$HostName = $env:COMPUTERNAME
Write-Ok "IP $ServerIp / name $HostName"

$origin = (Get-NetIPAddress -IPAddress $ServerIp -ErrorAction SilentlyContinue | Select-Object -First 1).PrefixOrigin
if ($origin -eq "Dhcp") { Write-Wrn "IP is from DHCP - reserve or fix it, a change invalidates the certificate" }

Write-Step "mkcert"

New-Item -ItemType Directory -Path $CertDir -Force | Out-Null
$mkcert = Join-Path $CertDir "mkcert.exe"

if (Test-Path $mkcert) {
    Write-Inf "Already present"
} elseif (Get-Command mkcert -ErrorAction SilentlyContinue) {
    $mkcert = (Get-Command mkcert).Source
    Write-Inf "Found on PATH"
} else {
    if (-not $hasInternet) {
        Write-Err "mkcert missing and no internet - copy it to $mkcert from:"
        Write-Host "    $MkcertUrl" -ForegroundColor Yellow
        exit 1
    }
    Write-Inf "Downloading $MkcertVersion"
    try { Invoke-WebRequest -Uri $MkcertUrl -OutFile $mkcert -UseBasicParsing }
    catch { Write-Err "Download failed: $($_.Exception.Message)"; Write-Host "    $MkcertUrl" -ForegroundColor Yellow; exit 1 }
}
Write-Ok "mkcert at $mkcert"

Write-Step "Certificate authority"

# regenerating the CA would invalidate every client already set up, so reuse any existing one
$caRootProbe = (& $mkcert -CAROOT 2>$null | Select-Object -First 1)
$alreadyCa = $false
if ($caRootProbe) { $alreadyCa = Test-Path (Join-Path $caRootProbe.Trim() "rootCA.pem") }

if ($alreadyCa -and -not $Force) {
    Write-Inf "CA already exists, keeping it"
    (Invoke-Native $mkcert @("-install")) | Out-Null
} else {
    $r = Invoke-Native $mkcert @("-install")
    $r.Output | ForEach-Object { Write-Inf $_ }
    if ($r.ExitCode -ne 0) { Write-Err "mkcert -install failed (exit $($r.ExitCode))"; exit 1 }
}

$caRoot = (& $mkcert -CAROOT 2>$null | Select-Object -First 1).Trim()
$caPem = Join-Path $caRoot "rootCA.pem"
if (-not (Test-Path $caPem)) { Write-Err "rootCA.pem not found in $caRoot"; exit 1 }
Write-Ok "CA root at $caPem"

Write-Step "Server certificate"

$crt = Join-Path $CertDir "earchive.crt"
$key = Join-Path $CertDir "earchive.key"

$needCert = $true
if ((Test-Path $crt) -and (Test-Path $key) -and -not $Force) {
    try {
        $existing = New-Object Security.Cryptography.X509Certificates.X509Certificate2($crt)
        $san = $existing.Extensions | Where-Object { $_.Oid.Value -eq "2.5.29.17" }
        $sanText = ""
        if ($san) { $sanText = $san.Format($false) }
        if ($sanText -match [regex]::Escape($ServerIp) -and $existing.NotAfter -gt (Get-Date).AddDays(30)) {
            Write-Inf "Valid certificate already covers $ServerIp until $($existing.NotAfter.ToString('yyyy-MM-dd')) - use -Force to reissue"
            $needCert = $false
        } else {
            Write-Inf "Existing certificate does not cover $ServerIp or expires soon - reissuing"
        }
    } catch { Write-Inf "Existing certificate unreadable - reissuing" }
}

if ($needCert) {
    (Invoke-Native $mkcert @("-cert-file", $crt, "-key-file", $key, $ServerIp, $HostName, "localhost", "127.0.0.1")).Output | ForEach-Object { Write-Inf $_ }
    if (-not (Test-Path $crt) -or -not (Test-Path $key)) { Write-Err "Certificate generation failed"; exit 1 }
}
Write-Ok "Certificate covers $ServerIp, $HostName, localhost, 127.0.0.1"

Write-Step "Publishing CA"

New-Item -ItemType Directory -Path $ShareDir -Force | Out-Null
Copy-Item $caPem (Join-Path $ShareDir "rootCA.pem") -Force

$bat = @(
    '@echo off',
    'certutil -addstore -f "ROOT" "%~dp0rootCA.pem"',
    'if %errorlevel%==0 (echo. & echo Done.) else (echo. & echo FAILED - run as administrator.)',
    'pause'
)
Set-Content -Path (Join-Path $ShareDir "install-certificate.bat") -Value $bat -Encoding ASCII

$sharePath = "\\$HostName\$ShareName"
if ($NoShare) {
    $sharePath = $ShareDir
    Write-Inf "Share skipped"
} elseif (Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue) {
    Write-Inf "Share $sharePath already exists"
} else {
    try {
        New-SmbShare -Name $ShareName -Path $ShareDir -ReadAccess "Everyone" -Description "e-Archive CA" | Out-Null
        Write-Ok "Share created: $sharePath"
    } catch {
        Write-Wrn "Share creation failed: $($_.Exception.Message)"
        $sharePath = $ShareDir
    }
}

$nginxConfigured = $false
$nginxExe = ""

if ($SkipNginx) {
    Write-Step "nginx (skipped)"
} else {
    Write-Step "nginx"

    if ([string]::IsNullOrWhiteSpace($DistPath)) {
        foreach ($g in @("C:\e-archive\client\dist", "C:\eArchive\client\dist", (Join-Path $PSScriptRoot "..\client\dist"))) {
            if (Test-Path (Join-Path $g "index.html")) { $DistPath = (Resolve-Path $g).Path; break }
        }
    }

    if ([string]::IsNullOrWhiteSpace($DistPath) -or -not (Test-Path (Join-Path $DistPath "index.html"))) {
        Write-Wrn "dist folder not found - re-run with -DistPath <path to client\dist>"
    } else {
        Write-Ok "Frontend: $DistPath"

        $running = Get-Process nginx -ErrorAction SilentlyContinue
        if ($running) {
            $p = $running | Select-Object -First 1
            if ($p.Path) { $nginxExe = $p.Path; $NginxDir = Split-Path $p.Path -Parent }
            Write-Inf "nginx already running (pid $($p.Id))"
        }

        if (-not $nginxExe) {
            foreach ($c in @((Join-Path $NginxDir "nginx.exe"), "C:\nginx\nginx.exe", "C:\Program Files\nginx\nginx.exe")) {
                if (Test-Path $c) { $nginxExe = $c; $NginxDir = Split-Path $c -Parent; break }
            }
            if ($nginxExe) { Write-Inf "nginx found at $nginxExe" }
        }

        if (-not $nginxExe) {
            if (-not $hasInternet) {
                Write-Wrn "nginx not installed and no internet - unzip to $NginxDir from:"
                Write-Host "    $NginxUrl" -ForegroundColor Yellow
            } else {
                Write-Inf "Downloading nginx $NginxVersion"
                $zip = Join-Path $env:TEMP "nginx-$NginxVersion.zip"
                try {
                    Invoke-WebRequest -Uri $NginxUrl -OutFile $zip -UseBasicParsing
                    $parent = Split-Path $NginxDir -Parent
                    Expand-Archive -Path $zip -DestinationPath $parent -Force
                    $extracted = Join-Path $parent "nginx-$NginxVersion"
                    if ((Test-Path $extracted) -and ($extracted -ne $NginxDir)) {
                        if (Test-Path $NginxDir) { Remove-Item $NginxDir -Recurse -Force }
                        Move-Item $extracted $NginxDir
                    }
                    $nginxExe = Join-Path $NginxDir "nginx.exe"
                    Write-Ok "nginx installed at $NginxDir"
                } catch { Write-Wrn "nginx install failed: $($_.Exception.Message)" }
            }
        }

        if ($nginxExe -and (Test-Path $nginxExe)) {
            $backend = Get-ListenerProcess -Port $BackendPort
            if ($backend) { Write-Ok "Backend listening on $BackendPort ($($backend.Name))" }
            else { Write-Wrn "Nothing listening on $BackendPort" }

            $confDir = Join-Path $NginxDir "conf"
            $confFile = Join-Path $confDir "nginx.conf"
            New-Item -ItemType Directory -Path $confDir -Force | Out-Null

            if (Test-Path $confFile) {
                if ((Get-Content $confFile -Raw) -notmatch [regex]::Escape($ConfigMarker)) {
                    $backup = "$confFile.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
                    Copy-Item $confFile $backup -Force
                    Write-Wrn "Existing nginx.conf backed up to $backup"
                }
            }

            $root = $DistPath.Replace('\', '/')
            $crtFwd = $crt.Replace('\', '/')
            $keyFwd = $key.Replace('\', '/')

            $conf = @"
$ConfigMarker
worker_processes  1;
events { worker_connections 1024; }

http {
    include       mime.types;
    default_type  application/octet-stream;
    sendfile      on;
    keepalive_timeout  65;
    client_max_body_size 512M;

    server {
        listen       $HttpsPort ssl;
        server_name  $ServerIp $HostName;

        ssl_certificate      "$crtFwd";
        ssl_certificate_key  "$keyFwd";
        ssl_protocols        TLSv1.2 TLSv1.3;

        root "$root";
        index index.html;

        location / {
            try_files `$uri `$uri/ /index.html;
        }

        location ~ ^/(admin|file-content)/ {
            proxy_pass http://127.0.0.1:$BackendPort;
            proxy_set_header Host              `$host;
            proxy_set_header X-Real-IP         `$remote_addr;
            proxy_set_header X-Forwarded-For   `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
            proxy_http_version 1.1;
            proxy_set_header Upgrade    `$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
        }
    }
}
"@
            Set-Content -Path $confFile -Value $conf -Encoding ASCII
            Write-Ok "Config written to $confFile"

            Push-Location $NginxDir
            try {
                $testRun = Invoke-Native $nginxExe @("-t")
                if ($testRun.ExitCode -ne 0) {
                    Write-Wrn "Config test failed - nothing changed:"
                    $testRun.Output | ForEach-Object { Write-Host "         $_" -ForegroundColor Yellow }
                } else {
                    Write-Ok "Config test passed"

                    # hand the port over only after the config is known good, and put the
                    # old static server back if nginx fails to take it
                    $holder = Get-ListenerProcess -Port $HttpsPort
                    $pm2Name = ""
                    if ($holder -and $holder.Name -ne "nginx") {
                        $pm2Proc = Get-Pm2ProcessByPid -ProcessId $holder.Pid
                        if ($pm2Proc) {
                            $pm2Name = $pm2Proc.name
                            Write-Inf "Stopping pm2 process '$pm2Name' holding port $HttpsPort"
                            (Invoke-Native "pm2" @("delete", $pm2Name)) | Out-Null
                            Start-Sleep -Seconds 2
                        } else {
                            Write-Wrn "Port $HttpsPort held by $($holder.Name) (pid $($holder.Pid)), not a pm2 process - stop it and re-run"
                        }
                    }

                    # a reload only works on a master started by this same account, so
                    # fall back to a hard restart rather than trusting it silently
                    $reloaded = $false
                    if (Get-Process nginx -ErrorAction SilentlyContinue) {
                        $rl = Invoke-Native $nginxExe @("-s", "reload")
                        if ($rl.ExitCode -eq 0) {
                            Start-Sleep -Seconds 2
                            if (Get-NetTCPConnection -State Listen -LocalPort $HttpsPort -ErrorAction SilentlyContinue) {
                                Write-Ok "nginx reloaded"
                                $reloaded = $true
                            }
                        }
                        if (-not $reloaded) {
                            Write-Inf "Reload did not take effect - restarting nginx"
                            (Invoke-Native $nginxExe @("-s", "stop")) | Out-Null
                            Start-Sleep -Seconds 2
                            Get-Process nginx -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                            Start-Sleep -Seconds 1
                        }
                    }

                    if (-not $reloaded) {
                        Start-Process -FilePath $nginxExe -WorkingDirectory $NginxDir -WindowStyle Hidden
                        Start-Sleep -Seconds 3
                    }

                    if (Get-NetTCPConnection -State Listen -LocalPort $HttpsPort -ErrorAction SilentlyContinue) {
                        Write-Ok "nginx listening on $HttpsPort"
                        $nginxConfigured = $true
                    } else {
                        Write-Err "nginx is not listening on $HttpsPort - see $NginxDir\logs\error.log"
                        if ($pm2Name) {
                            Write-Wrn "Restoring pm2 static server '$pm2Name'"
                            (Invoke-Native "pm2" @("serve", $DistPath, "$HttpsPort", "--name", $pm2Name, "--spa")) | Out-Null
                            (Invoke-Native "pm2" @("save")) | Out-Null
                        }
                    }
                }
            } finally { Pop-Location }
        }
    }
}

if ($nginxConfigured) {
    Write-Step "Autostart and firewall"

    $action = New-ScheduledTaskAction -Execute $nginxExe -Argument "-p `"$NginxDir`"" -WorkingDirectory $NginxDir
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
    try {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $taskPrincipal -Settings $settings -Force | Out-Null
        Write-Ok "nginx starts at boot (scheduled task '$TaskName')"
    } catch {
        Write-Wrn "Could not register autostart task: $($_.Exception.Message)"
    }

    if (Get-NetFirewallRule -DisplayName $FirewallRule -ErrorAction SilentlyContinue) {
        Write-Inf "Firewall rule already present"
    } else {
        try {
            New-NetFirewallRule -DisplayName $FirewallRule -Direction Inbound -Action Allow -Protocol TCP -LocalPort $HttpsPort -Profile Any | Out-Null
            Write-Ok "Firewall opened on TCP $HttpsPort"
        } catch { Write-Wrn "Could not add firewall rule: $($_.Exception.Message)" }
    }

    # served from one origin now, so the frontend must call the API with relative paths
    $cfg = Join-Path $DistPath "config.json"
    $sameOrigin = '{ "VITE_API_URL": "", "ADMIN_API_URL": "", "FILE_CONTENT_API_URL": "" }'
    if (Test-Path $cfg) {
        $current = (Get-Content $cfg -Raw)
        if ($current -match 'http') {
            Copy-Item $cfg "$cfg.bak-$(Get-Date -Format yyyyMMdd-HHmmss)" -Force
            Set-Content -Path $cfg -Value $sameOrigin -Encoding ASCII
            Write-Ok "config.json switched to same-origin (previous version backed up)"
        } else {
            Write-Inf "config.json already same-origin"
        }
    } else {
        Set-Content -Path $cfg -Value $sameOrigin -Encoding ASCII
        Write-Ok "config.json created (same-origin)"
    }
}

if ($hasPm2 -and $BackendName) {
    Write-Step "Restarting the app"
    # --update-env so a newly added variable is picked up rather than reused from the old process
    (Invoke-Native "pm2" @("restart", $BackendName, "--update-env")) | Out-Null
    Start-Sleep -Seconds 2
    if (Get-Pm2AppProcess) { Write-Ok "Backend '$BackendName' restarted" }
    else { Write-Wrn "Backend did not come back - check: pm2 logs $BackendName" }
    (Invoke-Native "pm2" @("save")) | Out-Null
    Write-Ok "pm2 process list saved"
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " Setup complete" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Certificate : $crt"
Write-Host " Private key : $key   (never copy this off the server)"
Write-Host ""
Write-Host " Run on each client machine, admin PowerShell, once:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   certutil -addstore -f `"ROOT`" $sharePath\rootCA.pem" -ForegroundColor White
Write-Host ""
if ($nginxConfigured) {
    Write-Host " App URL : https://$ServerIp`:$HttpsPort" -ForegroundColor Green
    Write-Host " Add HTTPS=true to e-archive\.env then: pm2 restart e-archive" -ForegroundColor Yellow
} else {
    Write-Host " nginx not configured - certificate exists but nothing serves HTTPS yet." -ForegroundColor Yellow
}
Write-Host ""

<#
SERVER - elevated PowerShell, from this folder

    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\setup-https-server.ps1

then add HTTPS=true to e-archive\.env and

    pm2 restart e-archive --update-env

CLIENT - copy C:\certs\client-setup\rootCA.pem from the server to the machine,
then elevated PowerShell, path pointing at wherever it was copied

    certutil -addstore -f "ROOT" C:\Users\Public\rootCA.pem

Open the App URL printed above. Firefox only: Settings -> Privacy & Security ->
Certificates -> View Certificates -> Authorities -> Import -> rootCA.pem ->
tick "Trust this CA to identify websites".
#>
