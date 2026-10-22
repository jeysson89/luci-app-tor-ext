param(
	[string]$HostName = "192.168.1.1",
	[string]$User = "root",
	[string]$KeyFile = "$env:USERPROFILE\.ssh\id_ed25519",
	[switch]$WithLyrebird
)

# ---------------------------------------------------------------------------
# Установка luci-app-tor-ext на роутер OpenWrt с компьютера под Windows.
#
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -HostName 192.168.1.1 -User root
#
# Скрипт копирует проект на роутер по SSH и запускает scripts/install-router.sh
# ---------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$target = "$User@$HostName"

if (-not (Test-Path $KeyFile)) {
	$alt = "$env:TEMP\opencode\owrt\id_ed25519"
	if (Test-Path $alt) { $KeyFile = $alt }
}

if (-not (Test-Path $KeyFile)) {
	throw "Не найден SSH-ключ ($KeyFile). Укажите его через -KeyFile."
}

Write-Host "==> копируем проект на $target"
cmd /c "tar -czf - -C ""$root"" scripts files dist | ssh -i ""$KeyFile"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$env:USERPROFILE\.ssh\known_hosts"" -o BatchMode=yes $target ""mkdir -p /tmp/luci-app-tor-ext && tar -xzf - -C /tmp/luci-app-tor-ext"""
if ($LASTEXITCODE -ne 0) { throw "Копирование не удалось" }

Write-Host "==> устанавливаем зависимости и приложение на роутере"
cmd /c "ssh -i ""$KeyFile"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$env:USERPROFILE\.ssh\known_hosts"" -o BatchMode=yes $target ""sh /tmp/luci-app-tor-ext/scripts/install-router.sh /tmp/luci-app-tor-ext"""
if ($LASTEXITCODE -ne 0) { throw "Установка не удалась" }

if ($WithLyrebird) {
	Write-Host "==> ставим транспорты (lyrebird)"
	cmd /c "ssh -i ""$KeyFile"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$env:USERPROFILE\.ssh\known_hosts"" -o BatchMode=yes $target ""sh /tmp/luci-app-tor-ext/scripts/install-lyrebird.sh"""
}

Write-Host "==> готово. Откройте http://$HostName/cgi-bin/luci/admin/services/tor-ext/status"
