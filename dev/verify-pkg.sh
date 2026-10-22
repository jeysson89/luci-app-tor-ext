#!/bin/sh
cd /tmp || exit 1
rm -rf /tmp/verify-pkg
mkdir -p /tmp/verify-pkg
apk extract --allow-untrusted --destination /tmp/verify-pkg /tmp/luci-app-tor-ext-1.0.0-r1.apk >/dev/null 2>&1
echo "== compare the package content with the working copy"
for f in usr/share/rpcd/ucode/tor-ext usr/libexec/tor-ext/apply-proxy usr/libexec/tor-ext/lib.sh usr/libexec/tor-ext/migrate www/luci-static/resources/view/tor-ext/bridges.js www/luci-static/resources/view/tor-ext/traffic.js www/luci-static/resources/view/tor-ext/status.js usr/share/luci/menu.d/luci-app-tor-ext.json usr/share/rpcd/acl.d/luci-app-tor-ext.json; do
	a=$(md5sum "/tmp/verify-pkg/$f" 2>/dev/null | awk '{print $1}')
	b=$(md5sum "/root/pkgroot/$f" 2>/dev/null | awk '{print $1}')
	[ "$a" = "$b" ] && echo "OK   $f" || echo "DIFF $f ($a vs $b)"
done
echo
echo "== package info"
apk adbdump /tmp/luci-app-tor-ext-1.0.0-r1.apk 2>/dev/null | head -18
