param(
  [int]$Port = 4173
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$distDir = Join-Path $scriptDir 'dist'

if (-not (Test-Path -Path $distDir -PathType Container)) {
  Write-Host "dist folder not found: $distDir" -ForegroundColor Red
  Write-Host "Please make sure dist is in the same folder." -ForegroundColor Yellow
  exit 1
}

$address = [System.Net.IPAddress]::Parse('127.0.0.1')
$listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
$entryUrl = "http://127.0.0.1:$Port/"

try {
  $listener.Start()
} catch {
  Write-Host "Cannot start local server at $entryUrl" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

try {
  Start-Process $entryUrl | Out-Null
} catch {
  Write-Host "Browser was not opened automatically, open it manually: $entryUrl" -ForegroundColor Yellow
}

Write-Host "Serving: $distDir" -ForegroundColor Cyan
Write-Host "Open: $entryUrl" -ForegroundColor Cyan
Write-Host "Press Ctrl+C (or close this window) to stop." -ForegroundColor Yellow

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      Handle-Client -Client $client -DistDir $distDir
    } catch {
      Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}

function Handle-Client {
  param(
    [Parameter(Mandatory = $true)] [System.Net.Sockets.TcpClient]$Client,
    [Parameter(Mandatory = $true)] [string]$DistDir
  )

  $stream = $Client.GetStream()
  $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)

  $requestLine = $reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    return
  }

  while ($true) {
    $headerLine = $reader.ReadLine()
    if ([string]::IsNullOrEmpty($headerLine)) {
      break
    }
  }

  $parts = $requestLine.Split(' ')
  if ($parts.Length -lt 2) {
    Send-Response -Stream $stream -StatusCode 400 -Reason 'Bad Request' -ContentType 'text/plain; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes('Bad Request'))
    return
  }

  $method = $parts[0].ToUpperInvariant()
  if ($method -ne 'GET' -and $method -ne 'HEAD') {
    Send-Response -Stream $stream -StatusCode 405 -Reason 'Method Not Allowed' -ContentType 'text/plain; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes('Method Not Allowed'))
    return
  }

  $target = $parts[1]
  $querySplitIndex = $target.IndexOf('?')
  if ($querySplitIndex -ge 0) {
    $target = $target.Substring(0, $querySplitIndex)
  }

  $decodedPath = [System.Uri]::UnescapeDataString($target)
  $relativePath = $decodedPath.TrimStart('/')
  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    $relativePath = 'index.html'
  }

  $sanitizedRelative = $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
  $candidatePath = Join-Path $DistDir $sanitizedRelative
  $fullDistPath = [System.IO.Path]::GetFullPath($DistDir)
  $fullCandidatePath = [System.IO.Path]::GetFullPath($candidatePath)

  if (-not $fullCandidatePath.StartsWith($fullDistPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    Send-Response -Stream $stream -StatusCode 404 -Reason 'Not Found' -ContentType 'text/plain; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes('Not Found'))
    return
  }

  if (Test-Path -Path $fullCandidatePath -PathType Container) {
    $fullCandidatePath = Join-Path $fullCandidatePath 'index.html'
  }

  $extension = [System.IO.Path]::GetExtension($fullCandidatePath)
  if (-not (Test-Path -Path $fullCandidatePath -PathType Leaf)) {
    if ([string]::IsNullOrEmpty($extension)) {
      $fullCandidatePath = Join-Path $DistDir 'index.html'
    } else {
      Send-Response -Stream $stream -StatusCode 404 -Reason 'Not Found' -ContentType 'text/plain; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes('Not Found'))
      return
    }
  }

  $body = [System.IO.File]::ReadAllBytes($fullCandidatePath)
  $contentType = Get-ContentType -Path $fullCandidatePath
  $headOnly = $method -eq 'HEAD'
  Send-Response -Stream $stream -StatusCode 200 -Reason 'OK' -ContentType $contentType -Body $body -HeadOnly $headOnly
}

function Send-Response {
  param(
    [Parameter(Mandatory = $true)] [System.IO.Stream]$Stream,
    [Parameter(Mandatory = $true)] [int]$StatusCode,
    [Parameter(Mandatory = $true)] [string]$Reason,
    [Parameter(Mandatory = $true)] [string]$ContentType,
    [Parameter(Mandatory = $true)] [byte[]]$Body,
    [bool]$HeadOnly = $false
  )

  $writer = [System.IO.StreamWriter]::new($Stream, [System.Text.Encoding]::ASCII, 1024, $true)
  $writer.NewLine = "`r`n"
  $writer.WriteLine("HTTP/1.1 $StatusCode $Reason")
  $writer.WriteLine("Content-Type: $ContentType")
  $writer.WriteLine("Content-Length: $($Body.Length)")
  $writer.WriteLine('Connection: close')
  $writer.WriteLine()
  $writer.Flush()

  if (-not $HeadOnly -and $Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
    $Stream.Flush()
  }
}

function Get-ContentType {
  param(
    [Parameter(Mandatory = $true)] [string]$Path
  )

  $extension = [System.IO.Path]::GetExtension($Path).ToLowerInvariant()
  switch ($extension) {
    '.html' { return 'text/html; charset=utf-8' }
    '.js' { return 'application/javascript; charset=utf-8' }
    '.mjs' { return 'application/javascript; charset=utf-8' }
    '.css' { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.svg' { return 'image/svg+xml' }
    '.png' { return 'image/png' }
    '.jpg' { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.ico' { return 'image/x-icon' }
    '.map' { return 'application/json; charset=utf-8' }
    '.woff' { return 'font/woff' }
    '.woff2' { return 'font/woff2' }
    default { return 'application/octet-stream' }
  }
}
