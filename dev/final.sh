#!/bin/sh
echo "== install the rebuilt package"
apk add --allow-untrusted /tmp/luci-app-tor-ext-1.0.0-r1.apk 2>&1 | tail -3
rm -f /tmp/luci-app-tor-ext-1.0.0-r1.apk
apk list --installed 2>/dev/null | grep tor-ext
echo
echo "== the new ui on the disk"
grep -c 'fillBackups' /www/luci-static/resources/view/tor-ext/config.js
grep -c 'backupDelete' /usr/share/rpcd/ucode/tor-ext
echo
echo "== the state"
ubus call tor-ext status | jsonfilter -e '@.service.running' -e '@.bootstrap.percent' -e '@.ip.ip' 2>/dev/null
ubus call tor-ext backups | jsonfilter -e '@.keep' -e '@.backups[*].name' 2>/dev/null
df -h /overlay | tail -1
