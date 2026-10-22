#!/bin/sh
echo "== the installed package vs the files on the disk"
rm -rf /tmp/chk && mkdir -p /tmp/chk
apk extract --allow-untrusted --destination /tmp/chk /tmp/luci-app-tor-ext-1.0.0-r1.apk >/dev/null 2>&1
for f in www/luci-static/resources/view/tor-ext/config.js www/luci-static/resources/view/tor-ext/bridges.js usr/share/rpcd/ucode/tor-ext usr/libexec/tor-ext/apply-proxy; do
	a=$(md5sum "/tmp/chk/$f" 2>/dev/null | awk '{print $1}')
	b=$(md5sum "/$f" 2>/dev/null | awk '{print $1}')
	[ "$a" = "$b" ] && echo "OK   $f" || echo "DIFF $f ($a / $b)"
done
echo
echo "== the uci defaults of the package"
grep -A 2 'config backup' /tmp/chk/etc/config/tor_ext 2>/dev/null
