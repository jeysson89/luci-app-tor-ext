param(
	[string]$HostName = "192.168.1.1",
	[string]$User = "root"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$files = Join-Path $root "files"
$dist = Join-Path $root "dist"
$d = "$env:TEMP\opencode\owrt"
$key = "$d\id_ed25519"
$kh = "$d\known_hosts"
$target = "$User@$HostName"

New-Item -ItemType Directory -Force -Path $dist | Out-Null

Write-Host "==> staging the package root on the router"
cmd /c "ssh -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes $target ""rm -rf /tmp/pkgroot; mkdir -p /tmp/pkgroot"""
cmd /c "tar -czf - -C ""$files"" . | ssh -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes $target ""tar -xzf - -C /tmp/pkgroot"""
if ($LASTEXITCODE -ne 0) { throw "staging failed" }

Write-Host "==> building the package"
cmd /c "ssh -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes $target ""sh /tmp/build-apk.sh /tmp/pkgroot /tmp/luci-app-tor-ext-1.0.0-r1.apk"""
if ($LASTEXITCODE -ne 0) { throw "build failed" }

Write-Host "==> downloading the package"
$pkg = Join-Path $dist "luci-app-tor-ext-1.0.0-r1.apk"
cmd /c "scp -O -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes ${target}:/tmp/luci-app-tor-ext-1.0.0-r1.apk ""$pkg"""
if ($LASTEXITCODE -ne 0) { throw "download failed" }

Get-Item $pkg | Select-Object Name, Length, LastWriteTime
