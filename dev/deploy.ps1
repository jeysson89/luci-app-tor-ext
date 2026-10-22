param(
	[string]$HostName = "192.168.1.1",
	[string]$User = "root",
	[switch]$NoRestart
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$files = Join-Path $root "files"
$d = "$env:TEMP\opencode\owrt"
$key = "$d\id_ed25519"
$kh = "$d\known_hosts"
$target = "$User@$HostName"

Write-Host "==> deploying $files to $target"
cmd /c "tar -czf - -C ""$files"" . | ssh -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes $target ""tar -xzf - -C /"""
if ($LASTEXITCODE -ne 0) { throw "tar/ssh failed" }

$setperm = @(
	"chmod 755 /etc/init.d/tor-ext /usr/libexec/tor-ext/* /usr/share/rpcd/ucode/tor-ext",
	"chmod 644 /usr/share/rpcd/acl.d/luci-app-tor-ext.json /usr/share/luci/menu.d/luci-app-tor-ext.json /etc/config/tor_ext",
	"chmod 600 /etc/config/tor_ext",
	"chmod 755 /etc/uci-defaults/95_luci-tor-ext"
) -join "; "

Write-Host "==> permissions"
cmd /c "ssh -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes $target ""$setperm"""

if (-not $NoRestart) {
	Write-Host "==> restarting rpcd, clearing LuCI caches"
	cmd /c "ssh -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes $target ""/etc/init.d/rpcd restart; rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache; /usr/libexec/tor-ext/apply-proxy apply; echo OK"""
}

Write-Host "==> done"
