#!/bin/sh
# Build the luci-app-tor-ext package (apk v3) with the static apk of Alpine.
# Usage: build-apk.sh <root-dir> <output-file>
set -e

ROOT="${1:-/tmp/pkgroot}"
OUT="${2:-/tmp/luci-app-tor-ext-1.0.0-r1.apk}"
APK=/tmp/apkstatic/sbin/apk.static

# the static apk of Alpine is used because it implements "apk mkpkg"
if [ ! -x "$APK" ]; then
	echo "== fetching the static apk of Alpine (apk-tools-static)"
	cd /tmp || exit 1
	curl -s -m 900 -o /tmp/apk-tools-static.apk \
		"https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/aarch64/apk-tools-static-3.0.8-r0.apk" || {
		echo "download failed"; exit 1; }
	rm -rf /tmp/apkstatic && mkdir -p /tmp/apkstatic
	apk extract --allow-untrusted --destination /tmp/apkstatic /tmp/apk-tools-static.apk >/dev/null 2>&1
	rm -f /tmp/apk-tools-static.apk
fi

[ -x "$APK" ] || { echo "static apk not found: $APK"; exit 1; }
[ -d "$ROOT" ] || { echo "package root not found: $ROOT"; exit 1; }

# file modes
find "$ROOT" -type d -exec chmod 0755 {} \; 2>/dev/null || true
chmod 0755 "$ROOT" 2>/dev/null || true
chmod 0755 "$ROOT/etc/init.d/tor-ext" 2>/dev/null || true
chmod 0755 "$ROOT/etc/uci-defaults/95_luci-tor-ext" 2>/dev/null || true
chmod 0755 "$ROOT"/usr/libexec/tor-ext/* 2>/dev/null || true
chmod 0755 "$ROOT/usr/libexec/tor-ext/migrate" 2>/dev/null || true
chmod 0755 "$ROOT/usr/share/rpcd/ucode/tor-ext" 2>/dev/null || true
chmod 0644 "$ROOT"/usr/share/rpcd/acl.d/*.json 2>/dev/null || true
chmod 0644 "$ROOT"/usr/share/luci/menu.d/*.json 2>/dev/null || true
chmod 0600 "$ROOT/etc/config/tor_ext" 2>/dev/null || true
chmod 0644 "$ROOT"/www/luci-static/resources/view/tor-ext/*.js 2>/dev/null || true
chmod 0644 "$ROOT"/www/luci-static/resources/tor-ext/*.js 2>/dev/null || true

INSTALLED_SIZE=$(du -sk "$ROOT" | awk '{print $1 * 1024}')

rm -f "$OUT"

"$APK" mkpkg \
	--files "$ROOT" \
	--info "name:luci-app-tor-ext" \
	--info "version:1.0.0-r1" \
	--info "arch:noarch" \
	--info "description:LuCI application for Tor: status, torrc editor, bridges, ports, hidden services, transparent proxying, logs and monitoring" \
	--info "url:https://github.com/luci-app-tor-ext" \
	--info "license:GPL-3.0-or-later" \
	--info "maintainer:luci-app-tor-ext contributors" \
	--info "depends:luci-base rpcd-mod-ucode tor curl nftables" \
	--script "post-install:/tmp/post-install.sh" \
	--output "$OUT"

ls -la "$OUT"
echo "== package info"
"$APK" adbdump "$OUT" 2>/dev/null | head -40
