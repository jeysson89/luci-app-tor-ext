#!/bin/sh
echo "== emulate the install: copy the project and run the installer"
rm -rf /tmp/luci-app-tor-ext
mkdir -p /tmp/luci-app-tor-ext
cd /tmp/luci-app-tor-ext || exit 1
tar -xzf /tmp/luci-app-tor-ext-files.tar.gz 2>/dev/null
echo
echo "== run install-router.sh"
sh /tmp/luci-app-tor-ext/scripts/install-router.sh /tmp/luci-app-tor-ext
echo
echo "== run install-lyrebird.sh"
sh /tmp/luci-app-tor-ext/scripts/install-lyrebird.sh
echo
echo "== result"
apk list --installed 2>/dev/null | grep -E 'tor-ext|tor-0|conntrack'
ubus call tor-ext status | jsonfilter -e '@.service.running' -e '@.bootstrap.percent' 2>/dev/null
