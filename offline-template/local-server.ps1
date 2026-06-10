param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

$root = Join-Path $PSScriptRoot "dist"

if (-not [System.IO.Directory]::Exists($root)) {
  Write-Host "未找到 dist 目录，请确认压缩包完整解压。"
  exit 1
}

$rootFull = [System.IO.Path]::GetFullPath($root).TrimEnd([System.IO.Path]::DirectorySeparatorChar)

# Priority 1: Check Python
$pythonCmd = $null
try {
  $py3Output = & py -3 -c "print('ok')" 2>&1
  if ($py3Output -match "ok") {
    $pythonCmd = "py -3"
  }
} catch {}

if ($null -eq $pythonCmd) {
  try {
    $pyOutput = & python -c "print('ok')" 2>&1
    if ($pyOutput -match "ok") {
      $pythonCmd = "python"
    }
  } catch {}
}

# Priority 1: Use Python HTTP Server if available
if ($null -ne $pythonCmd) {
  Write-Host "Detected Python, using python http.server fallback..."
  $port = 5177
  $maxPort = 5180
  $started = $false
  
  while ($port -le $maxPort) {
    Write-Host "Trying port $port..."
    
    $url = "http://127.0.0.1:$port"
    if (-not $NoBrowser) {
      Start-Process $url
    }
    
    if ($pythonCmd -eq "py -3") {
      & py -3 -m http.server $port -d "$rootFull"
    } else {
      & python -m http.server $port -d "$rootFull"
    }
    
    if ($LASTEXITCODE -eq 0) {
      $started = $true
      break
    } else {
      $port++
    }
  }
  
  if (-not $started) {
    Write-Host "Failed to start Python http.server. All ports in range used or other error."
    exit 1
  }
  exit 0
}

# Priority 2: PowerShell Static Server
Write-Host "No Python detected, using PowerShell static server..."
$hostAddress = "127.0.0.1"
$port = 5177
$maxPort = 5180
$listener = $null

while ($port -le $maxPort) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($hostAddress), $port)
    $listener.Start()
    break
  } catch {
    $listener = $null
    $port++
  }
}

if ($null -eq $listener) {
  Write-Host "Failed to start local server. Ports 5177 to 5180 may be in use."
  exit 1
}

$url = "http://$hostAddress`:$port/"
Write-Host "Offline version started: $url"
Write-Host "Press Ctrl+C to stop the local server."
if (-not $NoBrowser) {
  Start-Process $url
}

$mimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".svg" = "image/svg+xml"
  ".ico" = "image/x-icon"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".txt" = "text/plain; charset=utf-8"
  ".map" = "application/json; charset=utf-8"
  ".wasm" = "application/wasm"
}

function Get-MimeType {
  param([string]$Path)
  $ext = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  if ($mimeTypes.ContainsKey($ext)) {
    return $mimeTypes[$ext]
  }
  return "application/octet-stream"
}

function Resolve-StaticPath {
  param([string]$Target)

  $requestPath = ($Target -split "\?")[0]
  if ([string]::IsNullOrWhiteSpace($requestPath) -or $requestPath -eq "/") {
    $requestPath = "/index.html"
  }

  $decoded = [System.Uri]::UnescapeDataString($requestPath)
  $relative = $decoded.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $relative))

  if (-not $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  if ([System.IO.Directory]::Exists($full)) {
    $full = Join-Path $full "index.html"
  }

  return $full
}

function Write-HttpResponse {
  param(
    [System.IO.Stream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body,
    [bool]$SendBody
  )

  $headers = @(
    "HTTP/1.1 $StatusCode $StatusText",
    "Content-Type: $ContentType",
    "Content-Length: $($Body.Length)",
    "Cache-Control: no-store",
    "Connection: close",
    "",
    ""
  ) -join "\r\n"

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($SendBody -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

try {
  while ($true) {
    if (-not $listener.Pending()) {
      Start-Sleep -Milliseconds 100
      continue
    }

    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      do {
        $line = $reader.ReadLine()
      } while ($null -ne $line -and $line.Length -gt 0)

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $target = $parts[1]
      $sendBody = $method -ne "HEAD"

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
        Write-HttpResponse $stream 405 "Method Not Allowed" "text/plain; charset=utf-8" $body $sendBody
        continue
      }

      $filePath = Resolve-StaticPath $target
      if ($null -eq $filePath -or -not [System.IO.File]::Exists($filePath)) {
        $filePath = Join-Path $rootFull "index.html"
      }

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      Write-HttpResponse $stream 200 "OK" (Get-MimeType $filePath) $bytes $sendBody
    } catch {
      if ($null -ne $stream) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Internal Server Error")
        Write-HttpResponse $stream 500 "Internal Server Error" "text/plain; charset=utf-8" $body $true
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
