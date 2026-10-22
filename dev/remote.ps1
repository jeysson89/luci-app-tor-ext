param(
	[Parameter(Mandatory = $true)][string]$Script,
	[string]$HostName = "192.168.1.1",
	[string]$User = "root"
)

$d = "$env:TEMP\opencode\owrt"
$key = "$d\id_ed25519"
$kh = "$d\known_hosts"
$target = "$User@$HostName"

$text = Get-Content -Raw -LiteralPath $Script
$text = $text -replace "`r`n", "`n"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($text))

$remote = "echo $b64 | base64 -d > /tmp/.rsh.sh && sh /tmp/.rsh.sh"
cmd /c "ssh -i ""$key"" -o StrictHostKeyChecking=no -o UserKnownHostsFile=""$kh"" -o BatchMode=yes $target ""$remote"""
exit $LASTEXITCODE
